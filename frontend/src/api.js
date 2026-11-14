const TOKEN_KEY = "hmt_token";
export const auth = {
  get token() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set token(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} },
};

async function call(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth.token) { auth.token = null; window.dispatchEvent(new Event("hmt-logout")); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const body = (method, b) => ({ method, body: JSON.stringify(b ?? {}) });

export const api = {
  // auth
  login: (email, password, role) => call("/auth/login", body("POST", { email, password, role })),
  register: (data) => call("/auth/register", body("POST", data)),
  me: () => call("/auth/me"),
  // requests
  meta: () => call("/requests/meta"),
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return call(`/requests${qs ? `?${qs}` : ""}`);
  },
  unresolved: () => call("/requests/unresolved"),
  create: (b) => call("/requests", body("POST", b)),
  setPriority: (id, priority) => call(`/requests/${id}/priority`, body("PATCH", { priority })),
  setStatus: (id, status) => call(`/requests/${id}/status`, body("PATCH", { status })),
  resolve: (id, note) => call(`/requests/${id}/resolve`, body("PATCH", { note })),
  close: (id, note) => call(`/requests/${id}/close`, body("PATCH", { note })),
};
