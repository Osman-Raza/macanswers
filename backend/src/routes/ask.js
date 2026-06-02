import { Router } from "express";
import { z } from "zod";
import { embed, generateAnswer } from "../lib/gemini.js";
import supabase from "../lib/supabase.js";

const router = Router();

const AskSchema = z.object({
  question: z.string().min(3).max(500),
});

// ── Tunables ──────────────────────────────────────────────────────────────────
const MATCH_THRESHOLD = 0.3;
const MATCH_COUNT = 5;
const DEBUG = process.env.DEBUG_ASK === "1";

// ── Snow day / closure fast-path ──────────────────────────────────────────────
// We intercept weather-related closure questions BEFORE the vector search,
// because (a) McMaster has no permanent "current status" page to scrape, and
// (b) snow day answers are high-stakes (people decide whether to leave home),
// so an LLM-generated guess is worse than a deterministic check of recent
// announcements.

// Word lists for intent classification. To trigger the snow handler the
// question must clearly be ABOUT WEATHER, not just contain a closure word.
const WEATHER = /\b(snow|snowy|snowday|snowstorm|storm|stormy|blizzard|weather|winter|ice|icy|freezing rain|wind ?chill)\b/i;
const CLOSURE = /\b(closed|closure|cancel(?:l?ed|l?ation)?|off|shut|open|running|operating|in person|class(?:es)?)\b/i;
const TEMPORAL = /\b(today|tonight|tomorrow|tmrw|tmr|now|right now|currently|this (?:morning|afternoon|evening)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

/**
 * Decide whether a question is asking about a weather-related closure.
 * Conservative on purpose: requires explicit weather context. Questions like
 * "is the bus cancelled today" or "when is the career fair cancelled" fall
 * through to the normal vector search.
 */
function isSnowDayQuestion(q) {
  const hasWeather = WEATHER.test(q);
  if (!hasWeather) return false;

  // With weather word present, accept if there's either a temporal cue
  // ("snow tomorrow?") or a closure word ("snow closure", "is mac closed
  // because of weather").
  return TEMPORAL.test(q) || CLOSURE.test(q);
}

/**
 * Check the most recent McMaster Announcements chunk for an active closure.
 * Returns { closed: boolean, snippet: string|null }.
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

  // Require BOTH a closure word AND a weather word in the same chunk to
  // count as an active snow day. A general "X cancelled" article (e.g. an
  // event cancellation) shouldn't trigger this.
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

    // Normal RAG path
    const queryEmbedding = await embed(question);

    const { data: chunks, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
      match_threshold: MATCH_THRESHOLD,
    });

    if (error) throw error;

    if (DEBUG) {
      console.log(`\n[ASK] "${question}"`);
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