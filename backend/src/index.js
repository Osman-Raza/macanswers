import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import askRouter from "./routes/ask.js";
import issuesRouter from "./routes/issues.js";
import transitRouter from "./routes/transit.js";

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

// ── Startup checks ────────────────────────────────────────────────────────────
if (IS_PROD && (!process.env.FRONTEND_URL || process.env.FRONTEND_URL === "*")) {
  throw new Error("FRONTEND_URL must be set to a specific origin in production.");
}

// ── Middleware ────────────────────────────────────────────────────────────────
// Trust the first reverse proxy (Render/Vercel/Fly/Railway etc.) so req.ip
// reflects the real client IP instead of the proxy's IP. Without this, the
// daily rate-limiter would treat all traffic as a single user.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: false,
  })
);
app.use(express.json({ limit: "10kb" }));

// Per-IP rate limit — 20 requests per minute across all /api endpoints
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
});
app.use("/api", limiter);

// Stricter per-IP limit on /api/ask — 10/min
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many questions — wait a moment before asking again." },
});
app.use("/api/ask", askLimiter);

// Daily limit — 50 /api/ask per (IP + session combo). Session ID is client-set
// so determined users can rotate it, but IP-based fallback catches obvious abuse.
const askDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.headers["x-session-id"] || "anon"}`,
  message: { error: "Daily question limit reached — come back tomorrow." },
});
app.use("/api/ask", askDailyLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/ask", askRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/transit", transitRouter);

// Health check — actually pings dependencies instead of always returning ok.
app.get("/health", async (_req, res) => {
  const checks = { server: "ok" };
  try {
    const { default: supabase } = await import("./lib/supabase.js");
    const { error } = await supabase
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .limit(1);
    checks.supabase = error ? `error: ${error.message}` : "ok";
  } catch (e) {
    checks.supabase = `error: ${e.message}`;
  }
  const allOk = Object.values(checks).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json(checks);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`MacAnswers backend running on port ${PORT}`);
});