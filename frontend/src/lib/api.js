const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
    });
  },
  getIssues: () => request("/api/issues"),
  reportIssue: (payload) =>
    request("/api/issues", { method: "POST", body: JSON.stringify(payload) }),
  upvoteIssue: (id, voterToken) =>
    request(`/api/issues/${id}/upvote`, {
      method: "POST",
      body: JSON.stringify({ voterToken }),
    }),
  transitNext: (route, stop) => {
    const params = new URLSearchParams({ route });
    if (stop) params.set("stop", stop);
    return request(`/api/transit/next?${params}`);
  },
  shuttle: () => request("/api/transit/shuttle"),
};
