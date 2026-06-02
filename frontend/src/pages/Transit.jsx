import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import styles from "./Transit.module.css";

const POPULAR_ROUTES = ["1", "5", "10", "18", "23", "27", "33", "51", "52"];

function formatTime(timeStr) {
  // GTFS times can be > 24:00 for trips past midnight
  const [h, m] = timeStr.split(":").map(Number);
  const hour = h % 24;
  const ampm = hour < 12 ? "AM" : "PM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${String(m).padStart(2, "0")} ${ampm}`;
}

function minutesUntil(timeStr) {
  const [h, m, s] = timeStr.split(":").map(Number);
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const depSec = h * 3600 + m * 60 + s;
  return Math.round((depSec - nowSec) / 60);
}

export default function Transit() {
  const [route, setRoute] = useState("51");
  const [results, setResults] = useState(null);
  const [shuttle, setShuttle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("hsr");

  useEffect(() => {
    api.shuttle().then(setShuttle).catch(() => setShuttle([]));
  }, []);

  async function lookup(overrideRoute) {
    const routeToUse = (overrideRoute || route).trim();
    if (!routeToUse) return;
    setLoading(true);
    setResults(null);
    try {
      const data = await api.transitNext(routeToUse);
      setResults(data);
    } catch (err) {
      setResults({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <button className={`${styles.tabBtn} ${tab === "hsr" ? styles.active : ""}`} onClick={() => setTab("hsr")}>
          🚌 HSR Bus
        </button>
        <button className={`${styles.tabBtn} ${tab === "shuttle" ? styles.active : ""}`} onClick={() => setTab("shuttle")}>
          🔴 Mac Shuttle
        </button>
      </div>

      {tab === "hsr" && (
        <div className={styles.panel}>
          <div className={styles.lookupRow}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Route Number</label>
              <input
                className={styles.input}
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="e.g. 51"
              />
            </div>
            <button className={styles.lookupBtn} onClick={lookup} disabled={loading}>
              {loading ? "..." : "Next Buses"}
            </button>
          </div>

          <div className={styles.quickRoutes}>
            {POPULAR_ROUTES.map((r) => (
              <button
                key={r}
                className={`${styles.routeChip} ${route === r ? styles.activeChip : ""}`}
                onClick={() => { setRoute(r); lookup(r); }}
              >
                {r}
              </button>
            ))}
          </div>

          {results && !results.error && results.upcoming?.length > 0 && (
            <div className={styles.results}>
              <h3 className={styles.resultsTitle}>Route {results.route} — Next departures</h3>
              <div className={styles.departures}>
                {results.upcoming.map((d, i) => {
                  const mins = minutesUntil(d.departure_time);
                  return (
                    <div key={i} className={styles.departure}>
                      <div className={styles.depLeft}>
                        <span className={styles.depTime}>{formatTime(d.departure_time)}</span>
                        <span className={styles.depHead}>{d.trip_headsign}</span>
                        {d.stop_name && <span className={styles.depStop}>📍 {d.stop_name}</span>}
                      </div>
                      <div className={`${styles.depMins} ${mins < 5 ? styles.soon : ""}`}>
                        {mins < 1 ? "Now" : `${mins} min`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {results && results.upcoming?.length === 0 && (
            <p className={styles.empty}>No more departures today for route {results.route}.</p>
          )}

          {results?.error && (
            <p className={styles.error}>{results.error}</p>
          )}
        </div>
      )}

      {tab === "shuttle" && (
        <div className={styles.panel}>
          <h3 className={styles.shuttleTitle}>McMaster Shuttle Schedule</h3>
          {!shuttle && <p className={styles.empty}>Loading...</p>}
          {shuttle && shuttle.length === 0 && <p className={styles.empty}>No shuttle data available.</p>}
          {shuttle && shuttle.length > 0 && (
            <div className={styles.shuttleGrid}>
              {shuttle.map((row, i) => (
                <div key={i} className={styles.shuttleRow}>
                  <span className={styles.shuttleDay}>{row.day_label}</span>
                  <span className={styles.shuttleTime}>{row.time_range}</span>
                  <span className={styles.shuttleFreq}>{row.frequency}</span>
                </div>
              ))}
            </div>
          )}
          <p className={styles.shuttleNote}>
            Shuttle runs between McMaster and downtown Hamilton. Schedule updated weekly.
          </p>
        </div>
      )}
    </div>
  );
}