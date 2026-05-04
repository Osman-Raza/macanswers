import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import askRouter from "./routes/ask.js";
import issuesRouter from "./routes/issues.js";
import transitRouter from "./routes/transit.js";
import { scheduleDigest } from "./services/digest.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Per-IP rate limit — 20 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
});
app.use("/api", limiter);

// Stricter limit specifically for /api/ask — 10 per minute per IP
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many questions — wait a moment before asking again." },
});
app.use("/api/ask", askLimiter);

// Daily limit per session — 50 questions per day
const askDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,  // 24 hours
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers["x-session-id"] || req.ip,
  message: { error: "Daily question limit reached — come back tomorrow." },
});
app.use("/api/ask", askDailyLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/ask", askRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/transit", transitRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Scheduled jobs ────────────────────────────────────────────────────────────
scheduleDigest(); // weekly email to facilities

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`MacAnswers backend running on port ${PORT}`);
});
