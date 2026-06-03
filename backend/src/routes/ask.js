import { Router } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import { embed, generateAnswer } from "../lib/gemini.js";
import supabase from "../lib/supabase.js";

const router = Router();

// Groq client used here for query expansion. (Answer generation uses its own
// client inside lib/gemini.js — keeping them separate is fine.)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AskSchema = z.object({
  question: z.string().min(3).max(500),
});

// ── Tunables ──────────────────────────────────────────────────────────────────
const MATCH_THRESHOLD = 0.3;
const MATCH_COUNT = 5;
const DEBUG = process.env.DEBUG_ASK === "1";

// ── Query expansion ───────────────────────────────────────────────────────────
// Before embedding, send the user's question through Groq to expand it with
// synonyms and formal terms McMaster's official pages might use. This bridges
// vocabulary gaps — e.g. user says "therapy" but the wellness page says
// "counselling", or user says "CS" but the page says "Computer Science."
//
// The expansion is COMBINED with the original question for embedding, so the
// user's exact wording still matters but we get extra topical signal.
//
// Cost: ~500ms extra latency and a tiny Groq token bill per query. Failures
// fall back to embedding the original question untouched.
async function expandQuery(question) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a search query expander for a McMaster University student help system.
Take the user's question and output an expanded search query containing:
- The user's original terms
- Likely synonyms McMaster's official pages might use (e.g. "therapy" -> "counselling", "rec" -> "Recreation Centre", "dorm" -> "residence")
- Related formal terms (e.g. "cheating" -> "academic integrity", "drop a class" -> "course withdrawal")
- Expand acronyms (e.g. "CS" -> "Computer Science", "OSAP" -> "Ontario Student Assistance Program")

Output ONLY the expanded query as a single line of comma-separated phrases.
No explanations, no quotes, no labels, no "Expanded:" prefix.
Keep it under 30 words total.`,
        },
        { role: "user", content: question },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });
    return completion.choices[0].message.content.trim();
  } catch (e) {
    console.error("[ASK] query expansion failed:", e.message);
    return ""; // graceful fallback — original query still embeds
  }
}

// ── Snow day / closure fast-path ──────────────────────────────────────────────
// We intercept weather-related closure questions BEFORE the vector search,
// because (a) McMaster has no permanent "current status" page to scrape, and
// (b) snow day answers are high-stakes (people decide whether to leave home),
// so an LLM-generated guess is worse than a deterministic check of recent
// announcements.

const WEATHER = /\b(snow|snowy|snowday|snowstorm|storm|stormy|blizzard|weather|winter|ice|icy|freezing rain|wind ?chill)\b/i;
const CLOSURE = /\b(closed|closure|cancel(?:l?ed|l?ation)?|off|shut|open|running|operating|in person|class(?:es)?)\b/i;
const TEMPORAL = /\b(today|tonight|tomorrow|tmrw|tmr|now|right now|currently|this (?:morning|afternoon|evening)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

/**
 * Decide whether a question is asking about a weather-related closure.
 * Conservative on purpose: requires explicit weather context.
 */
function isSnowDayQuestion(q) {
  const hasWeather = WEATHER.test(q);
  if (!hasWeather) return false;
  return TEMPORAL.test(q) || CLOSURE.test(q);
}

/**
 * Check the most recent McMaster Announcements chunk for an active closure.
 */
async function checkRecentClosure() {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("content, source_url, scraped_at")
    .eq("source_name", "McMaster Announcements")
    .order("scraped_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return { closed: false, snippet: null };

  const text = data[0].content || "";
  const closureMention = /\b(closed|closure|cancel(?:l?ed|l?ation)?)\b/i.test(text);
  const weatherMention = WEATHER.test(text);

  return {
    closed: closureMention && weatherMention,
    snippet: text.slice(0, 500),
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const parsed = AskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid question." });
  }

  const { question } = parsed.data;

  try {
    // Fast-path: weather-related closure questions never hit the LLM.
    if (isSnowDayQuestion(question)) {
      const { closed } = await checkRecentClosure();
      if (DEBUG) {
        console.log(`\n[ASK] "${question}"`);
        console.log(`[ASK] → snow day fast-path; closed=${closed}`);
      }
      if (closed) {
        return res.json({
          answer:
            "Yes — McMaster has announced a closure due to weather. " +
            "All scheduled classes, labs, and events are cancelled. " +
            "Check McMaster Daily News for full details.",
          source: "https://dailynews.mcmaster.ca/",
          lowConfidence: false,
        });
      }
      return res.json({
        answer:
          "No weather-related closure has been announced. McMaster's policy is " +
          "that if no announcement has been made, the university is open and " +
          "all classes are running normally. Closures are typically posted by " +
          "6:00 AM on the affected day. Check McMaster Daily News for the latest updates.",
        source: "https://dailynews.mcmaster.ca/",
        lowConfidence: false,
      });
    }

    // Normal RAG path with query expansion
    const expansion = await expandQuery(question);
    const searchText = expansion ? `${question} ${expansion}` : question;

    if (DEBUG) {
      console.log(`\n[ASK] "${question}"`);
      console.log(`[ASK] expanded: "${expansion}"`);
    }

    const queryEmbedding = await embed(searchText);

    const { data: chunks, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
      match_threshold: MATCH_THRESHOLD,
    });

    if (error) throw error;

    if (DEBUG) {
      console.log(`[ASK] retrieved ${chunks?.length ?? 0} chunks @ threshold ${MATCH_THRESHOLD}`);
      (chunks || []).forEach((c, i) => {
        console.log(
          `  [${i + 1}] sim=${c.similarity.toFixed(3)} ${c.source_name} :: ${c.content.slice(0, 120)}...`
        );
      });
    }

    if (!chunks || chunks.length === 0) {
      return res.json({
        answer: null,
        source: "https://mcmaster.ca",
        lowConfidence: true,
        message: "No relevant information found. Try checking the McMaster website directly.",
      });
    }

    const { answer, source, lowConfidence } = await generateAnswer(question, chunks);

    if (DEBUG) {
      console.log(`[ASK] → LLM result: ${lowConfidence ? "LOW_CONFIDENCE" : "answered"}`);
      if (answer) console.log(`[ASK] → "${answer.slice(0, 200)}..."`);
    }

    return res.json({ answer, source, lowConfidence });
  } catch (err) {
    console.error("Ask error:", err);
    return res.status(500).json({ error: "Something went wrong. Try again." });
  }
});

export default router;