import { Router } from "express";
import { z } from "zod";
import supabase from "../lib/supabase.js";

const router = Router();

const CATEGORIES = ["electrical", "printer", "accessibility", "safety", "hvac", "plumbing", "wifi", "other"];

const IssueSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().max(500).optional(),
  category: z.enum(CATEGORIES),
  latitude: z.number().min(43.2).max(43.3),
  longitude: z.number().min(-79.95).max(-79.9),
  building: z.string().max(80).optional(),
});

async function requireMcMasterAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in with your McMaster email to continue." });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }
  if (!user.email?.endsWith("@mcmaster.ca")) {
    return res.status(403).json({ error: "Only McMaster email addresses are allowed." });
  }
  req.user = user;
  next();
}

// ── GET /api/issues — public ──────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("campus_issues")
    .select("id, title, description, category, status, latitude, longitude, building, upvotes, reported_at, user_id")
    .neq("status", "resolved")
    .order("upvotes", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── POST /api/issues — requires McMaster auth ─────────────────────────────────
router.post("/", requireMcMasterAuth, async (req, res) => {
  const parsed = IssueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid issue data.", details: parsed.error.flatten() });
  }
  const { data, error } = await supabase
    .from("campus_issues")
    .insert({ ...parsed.data, user_id: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ── DELETE /api/issues/:id — owner only ──────────────────────────────────────
router.delete("/:id", requireMcMasterAuth, async (req, res) => {
  const { id } = req.params;

  // Check ownership first
  const { data: issue, error: fetchError } = await supabase
    .from("campus_issues")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchError || !issue) return res.status(404).json({ error: "Issue not found." });
  if (issue.user_id !== req.user.id) return res.status(403).json({ error: "You can only delete your own issues." });

  const { error } = await supabase.from("campus_issues").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ── POST /api/issues/:id/upvote — requires McMaster auth ─────────────────────
router.post("/:id/upvote", requireMcMasterAuth, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.rpc("increment_upvote", {
    issue_id: id,
    user_id: req.user.id,
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ── PATCH /api/issues/:id/resolve ────────────────────────────────────────────
router.patch("/:id/resolve", requireMcMasterAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("campus_issues")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

export default router;
