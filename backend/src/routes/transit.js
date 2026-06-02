import { Router } from "express";
import supabase from "../lib/supabase.js";

const router = Router();

// GTFS times can exceed 24:00 for trips that span past midnight as part of
// "today's service day". E.g. 25:45:00 = 1:45 AM the next morning.
// We need to handle both same-day departures and after-midnight ones.

function nowAsGtfsSeconds() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

// Pad a seconds-since-midnight value back into GTFS HH:MM:SS format
function gtfsTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── GET /api/transit/next?route=18&stop=3456 ─────────────────────────────────
router.get("/next", async (req, res) => {
  const { route, stop } = req.query;
  if (!route) {
    return res.status(400).json({ error: "route query param required." });
  }

  try {
    const nowSec = nowAsGtfsSeconds();
    const cutoff = gtfsTime(nowSec);

    // Filter in the database: only departures >= now, ordered ascending,
    // limit to 10. Lexicographic comparison works because GTFS times are
    // zero-padded fixed-width.
    let query = supabase
      .from("transit_departures")
      .select("route_short_name, trip_headsign, departure_time, stop_id, stop_name")
      .in("route_short_name", [route, route.padStart(2, "0")])
      .gte("departure_time", cutoff)
      .order("departure_time", { ascending: true })
      .limit(10);

    if (stop) query = query.eq("stop_id", stop);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ route, upcoming: data || [] });
  } catch (err) {
    console.error("Transit error:", err);
    return res.status(500).json({ error: "Could not fetch transit data." });
  }
});

// ── GET /api/transit/shuttle ──────────────────────────────────────────────────
router.get("/shuttle", async (_req, res) => {
  const { data, error } = await supabase
    .from("shuttle_schedule")
    .select("*")
    .order("day_order", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

export default router;