import { supabase } from "../auth/supabase.js";
import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { api } from "../lib/api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import styles from "./IssueTracker.module.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MCMASTER_CENTER = [-79.9192, 43.2609];

const CATEGORY_COLORS = {
  electrical:    "#f59e0b",
  printer:       "#6366f1",
  accessibility: "#10b981",
  safety:        "#ef4444",
  hvac:          "#3b82f6",
  plumbing:      "#8b5cf6",
  wifi:          "#06b6d4",
  other:         "#6b7280",
};

const CATEGORY_LABELS = {
  electrical:    "⚡ Electrical",
  printer:       "🖨️ Printer",
  accessibility: "♿ Accessibility",
  safety:        "🚨 Safety",
  hvac:          "🌡️ HVAC",
  plumbing:      "🔧 Plumbing",
  wifi:          "📶 WiFi",
  other:         "📌 Other",
};

function IssueCard({ issue, onUpvote, onDelete, userUpvoted, isOwner }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span
          className={styles.categoryBadge}
          style={{ background: CATEGORY_COLORS[issue.category] + "22", color: CATEGORY_COLORS[issue.category] }}
        >
          {CATEGORY_LABELS[issue.category]}
        </span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            className={`${styles.upvoteBtn} ${userUpvoted ? styles.upvoted : ""}`}
            onClick={() => onUpvote(issue.id)}
          >
            ▲ {issue.upvotes}
          </button>
          {isOwner && (
            <button
              className={styles.deleteBtn}
              onClick={() => onDelete(issue.id)}
              title="Delete your issue"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <p className={styles.cardTitle}>{issue.title}</p>
      {issue.description && <p className={styles.cardDesc}>{issue.description}</p>}
      {issue.building && <p className={styles.cardBuilding}>📍 {issue.building}</p>}
    </div>
  );
}

function ReportModal({ lngLat, onClose, onSubmit }) {
  const [form, setForm] = useState({ title: "", description: "", category: "other", building: "" });
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit() {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ ...form, latitude: lngLat.lat, longitude: lngLat.lng });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Report an Issue</h3>
        <p className={styles.modalCoords}>{lngLat.lat.toFixed(5)}, {lngLat.lng.toFixed(5)}</p>

        <label className={styles.label}>Category</label>
        <select className={styles.select} value={form.category} onChange={(e) => set("category", e.target.value)}>
          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <label className={styles.label}>Title *</label>
        <input className={styles.input} placeholder="e.g. Outlet not working near window" value={form.title} onChange={(e) => set("title", e.target.value)} />

        <label className={styles.label}>Building (optional)</label>
        <input className={styles.input} placeholder="e.g. Mills Library" value={form.building} onChange={(e) => set("building", e.target.value)} />

        <label className={styles.label}>Description (optional)</label>
        <textarea className={styles.textarea} rows={3} placeholder="Additional details..." value={form.description} onChange={(e) => set("description", e.target.value)} />

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading || !form.title.trim()}>
            {loading ? "Submitting..." : "Submit Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IssueTracker({ onSignInRequired }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [issues, setIssues] = useState([]);
  const [pendingLngLat, setPendingLngLat] = useState(null);
  const [upvotedIds, setUpvotedIds] = useState(new Set());
  const { user } = useAuth();

  // Load user's existing upvotes from database
  useEffect(() => {
    if (!user) {
      setUpvotedIds(new Set());
      return;
    }
    async function loadUpvotes() {
      const { data } = await supabase
        .from("issue_upvotes")
        .select("issue_id")
        .eq("user_id", user.id);
      if (data) {
        setUpvotedIds(new Set(data.map((r) => r.issue_id)));
      }
    }
    loadUpvotes();
  }, [user]);

  useEffect(() => {
    if (mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: MCMASTER_CENTER,
      zoom: 15.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("click", (e) => {
      if (!user) { onSignInRequired(); return; }
      setPendingLngLat(e.lngLat);
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [user]);

  useEffect(() => {
    api.getIssues().then(setIssues).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    issues.forEach((issue) => {
      const size = Math.max(14, Math.min(34, 14 + issue.upvotes * 2));
      const el = document.createElement("div");
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${CATEGORY_COLORS[issue.category]};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;transition:transform 0.15s ease;`;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
        .setHTML(`<strong style="font-family:Sora,sans-serif;font-size:13px">${issue.title}</strong><br/><span style="font-size:12px;color:#666">${CATEGORY_LABELS[issue.category]} · ▲ ${issue.upvotes}</span>${issue.building ? `<br/><span style="font-size:11px;color:#888">📍 ${issue.building}</span>` : ""}`);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([issue.longitude, issue.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [issues]);

  async function handleUpvote(id) {
    if (!user) { onSignInRequired(); return; }
    if (upvotedIds.has(id)) return;
    try {
      await api.upvoteIssue(id, user.id);
      setUpvotedIds((prev) => new Set([...prev, id]));
      setIssues((prev) => prev.map((i) => i.id === id ? { ...i, upvotes: i.upvotes + 1 } : i));
    } catch { /* already voted */ }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this issue?")) return;
    try {
      await api.deleteIssue(id);
      setIssues((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReport(payload) {
    const newIssue = await api.reportIssue(payload);
    setIssues((prev) => [newIssue, ...prev]);
  }

  return (
    <div className={styles.page}>
      <div ref={mapContainer} className={styles.map} />

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Open Issues</h2>
          <p className={styles.sidebarHint}>
            {user ? "Click the map to report a new issue." : "Sign in with your McMaster email to report or vote."}
          </p>
        </div>
        <div className={styles.issueList}>
          {issues.length === 0 && <p className={styles.empty}>No open issues — campus is looking good 🎉</p>}
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onUpvote={handleUpvote}
              onDelete={handleDelete}
              userUpvoted={upvotedIds.has(issue.id)}
              isOwner={user?.id === issue.user_id}
            />
          ))}
        </div>
      </aside>

      {pendingLngLat && (
        <ReportModal
          lngLat={pendingLngLat}
          onClose={() => setPendingLngLat(null)}
          onSubmit={handleReport}
        />
      )}
    </div>
  );
}
