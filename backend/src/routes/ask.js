import { Router } from "express";
import { z } from "zod";
import { embed, generateAnswer } from "../lib/gemini.js";
import supabase from "../lib/supabase.js";

const router = Router();

const AskSchema = z.object({
  question: z.string().min(3).max(500),
});

// Tunable: lower = more permissive recall. Was 0.45 with un-normalized vectors;
// with proper L2-normalized 768-dim embeddings, real cosine values tend to be
// lower in absolute terms. Start at 0.3 and tune from real queries.
const MATCH_THRESHOLD = 0.3;
const MATCH_COUNT = 5;
const DEBUG = process.env.DEBUG_ASK === "1";

router.post("/", async (req, res) => {
  const parsed = AskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid question." });
  }

  const { question } = parsed.data;

  try {
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
      if (DEBUG) console.log("[ASK] → no chunks above threshold, returning LOW_CONFIDENCE");
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