import { Router } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import { embed, generateAnswer } from "../lib/gemini.js";
import supabase from "../lib/supabase.js";

const router = Router();

// Groq client used for query expansion AND for reranking.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AskSchema = z.object({
  question: z.string().min(3).max(500),
});

// ── Tunables ──────────────────────────────────────────────────────────────────
const MATCH_THRESHOLD = 0.2;
const CANDIDATE_POOL = 20;        // hybrid retrieval returns this many
const FINAL_CHUNK_COUNT = 5;      // reranker narrows to this many for answer
const DEBUG = process.env.DEBUG_ASK === "1";

// ── Query expansion ───────────────────────────────────────────────────────────
// Bridges vocabulary gaps before retrieval (e.g. "therapy" -> "counselling").
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
    return "";
  }
}

// ── Reranker ──────────────────────────────────────────────────────────────────
// Takes the user's question + a pool of candidate chunks (typically 20 from
// hybrid retrieval) and asks an LLM to pick the N most directly relevant ones.
//
// Why this matters: hybrid retrieval surfaces chunks that mention the query's
// topics, but it can't tell which chunks ANSWER the question. For "what are
// the rec centre hours" hybrid might rank "athletics mission statement"
// higher than "Hours: 6am-10pm" because the mission statement has more
// keyword overlap. The reranker reads the actual content and picks the
// chunk that contains the answer.
//
// The reranker is given chunks LABELED 0..N-1. We ask it to return ONLY a
// JSON array of the top indices, e.g. [3, 0, 7, 1, 12]. This is much more
// reliable than asking it to regenerate the chunks themselves.
//
// If the call fails (network, parse error, etc.), we fall back to taking the
// top N by RRF score so the pipeline never blocks on rerank failures.
async function rerankChunks(question, chunks, topN) {
  if (!chunks || chunks.length === 0) return [];
  if (chunks.length <= topN) return chunks;

  // Build a compact, numbered list. Truncate each chunk so the whole prompt
  // stays well under the model's context window.
  const candidateText = chunks
    .map((c, i) => {
      const preview = (c.content || "").slice(0, 600);
      return `[${i}] (${c.source_name})\n${preview}`;
    })
    .join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a relevance ranker for a McMaster University student help system.

You will be given a student's question and a numbered list of candidate text chunks. Your job: pick the chunks that BEST and most DIRECTLY answer the question.

Rules:
- Prefer chunks that contain specific facts, numbers, dates, hours, prices, names, or step-by-step procedures that directly answer the question.
- Prefer chunks that mention the SPECIFIC topic of the question (e.g. if asked about "rec centre hours", pick the chunk literally listing hours, not a chunk about the rec centre's mission statement).
- Avoid chunks that are purely navigation, mission statements, branding, or only tangentially related.
- If the question is about a specific program or category (e.g. nursing tuition), prefer chunks specifically about THAT program over generic info.

Output format: return ONLY a JSON array of the top ${topN} chunk numbers, ordered most-relevant first.
Example output: [3, 7, 0, 12, 5]

No explanation, no markdown, no code fences. Just the JSON array.`,
        },
        {
          role: "user",
          content: `Question: ${question}\n\nCandidates:\n${candidateText}\n\nReturn the top ${topN} chunk numbers as a JSON array.`,
        },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content.trim();

    // Robust parse: find the first [...] in the response
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error(`No JSON array in rerank response: ${raw}`);

    const indices = JSON.parse(match[0]);
    if (!Array.isArray(indices)) throw new Error("Rerank response is not an array");

    // Validate and dedupe indices
    const seen = new Set();
    const validIndices = indices
      .filter((i) => Number.isInteger(i) && i >= 0 && i < chunks.length && !seen.has(i) && seen.add(i))
      .slice(0, topN);

    if (validIndices.length === 0) throw new Error("Rerank returned no valid indices");

    // If reranker returned fewer than topN, top up with highest-RRF chunks
    // we haven't already picked.
    if (validIndices.length < topN) {
      for (let i = 0; i < chunks.length && validIndices.length < topN; i++) {
        if (!seen.has(i)) {
          validIndices.push(i);
          seen.add(i);
        }
      }
    }

    if (DEBUG) {
      console.log(`[ASK] reranker picked indices: [${validIndices.join(", ")}]`);
    }

    return validIndices.map((i) => chunks[i]);
  } catch (e) {
    console.error("[ASK] rerank failed, falling back to RRF order:", e.message);
    return chunks.slice(0, topN);
  }
}

// ── Snow day / closure fast-path ──────────────────────────────────────────────
const WEATHER = /\b(snow|snowy|snowday|snowstorm|storm|stormy|blizzard|weather|winter|ice|icy|freezing rain|wind ?chill)\b/i;
const CLOSURE = /\b(closed|closure|cancel(?:l?ed|l?ation)?|off|shut|open|running|operating|in person|class(?:es)?)\b/i;
const TEMPORAL = /\b(today|tonight|tomorrow|tmrw|tmr|now|right now|currently|this (?:morning|afternoon|evening)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

function isSnowDayQuestion(q) {
  const hasWeather = WEATHER.test(q);
  if (!hasWeather) return false;
  return TEMPORAL.test(q) || CLOSURE.test(q);
}

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
    // Fast-path: weather-related closure questions never hit retrieval/LLM.
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

    // ── Normal RAG path with hybrid retrieval + reranking ───────────────────
    //
    // Pipeline:
    //   1. Expand the user's query via Groq (vocabulary bridging)
    //   2. Embed combined original + expansion
    //   3. Hybrid retrieval (vector + BM25 + RRF) -> 20 candidates
    //   4. Rerank candidates with Groq -> top 5 most directly relevant
    //   5. Pass top 5 to generateAnswer

    const expansion = await expandQuery(question);
    const searchText = expansion ? `${question} ${expansion}` : question;

    if (DEBUG) {
      console.log(`\n[ASK] "${question}"`);
      console.log(`[ASK] expanded: "${expansion}"`);
    }

    const queryEmbedding = await embed(searchText);

    const { data: chunks, error } = await supabase.rpc("hybrid_search", {
      query_embedding: queryEmbedding,
      query_text: searchText,
      match_count: CANDIDATE_POOL,
      match_threshold: MATCH_THRESHOLD,
    });

    if (error) throw error;

    if (DEBUG) {
      console.log(`[ASK] hybrid retrieved ${chunks?.length ?? 0} candidates`);
      (chunks || []).slice(0, 10).forEach((c, i) => {
        const v = (c.vector_sim ?? 0).toFixed(3);
        const t = (c.text_rank ?? 0).toFixed(3);
        const s = (c.combined_score ?? 0).toFixed(4);
        console.log(
          `  [${i}] v=${v} t=${t} rrf=${s} ${c.source_name} :: ${c.content.slice(0, 100)}...`
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

    // ── Stage 3: rerank ─────────────────────────────────────────────────────
    const topChunks = await rerankChunks(question, chunks, FINAL_CHUNK_COUNT);

    if (DEBUG) {
      console.log(`[ASK] reranked top ${topChunks.length}:`);
      topChunks.forEach((c, i) => {
        console.log(
          `  rerank[${i}] ${c.source_name} :: ${c.content.slice(0, 100)}...`
        );
      });
    }

    const { answer, source, lowConfidence } = await generateAnswer(question, topChunks);

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