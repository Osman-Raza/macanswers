import { supabase } from "../auth/supabase.js";


const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  // Get current session token if available
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  ask: (question) => {
    const sessionId = sessionStorage.getItem("mac_session") || crypto.randomUUID();
    sessionStorage.setItem("mac_session", sessionId);
    return request("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
      headers: { "x-session-id": sessionId },
    });
  },

  getIssues: () => request("/api/issues"),
  

  reportIssue: (payload) =>
    request("/api/issues", { method: "POST", body: JSON.stringify(payload) }),

  upvoteIssue: (id, userId) =>
    request(`/api/issues/${id}/upvote`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  deleteIssue: (id) =>
    request(`/api/issues/${id}`, { method: "DELETE" }),

  transitNext: (route, stop) => {
    const params = new URLSearchParams({ route });
    if (stop) params.set("stop", stop);
    return request(`/api/transit/next?${params}`);
  },

  shuttle: () => request("/api/transit/shuttle"),
};
