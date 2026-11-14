import { useCallback, useEffect, useState } from "react";
import { api, auth } from "./api";
import Login from "./Login.jsx";

const fmt = (d) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!auth.token);
  const [meta, setMeta] = useState({ categories: [], priorities: [], statuses: [] });

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    if (auth.token) api.me().then((r) => setUser(r.user)).catch(() => (auth.token = null)).finally(() => setChecking(false));
    const onLogout = () => setUser(null);
    window.addEventListener("hmt-logout", onLogout);
    return () => window.removeEventListener("hmt-logout", onLogout);
  }, []);

  const onLogin = ({ token, user }) => { auth.token = token; setUser(user); };
  const logout = () => { auth.token = null; setUser(null); };

  if (checking) return <div className="center-screen">Loading…</div>;
  if (!user) return <Login onLogin={onLogin} />;
  return <Dashboard key={user.id} user={user} meta={meta} logout={logout} />;
}

function Dashboard({ user, meta, logout }) {
  const isAdmin = user.role === "admin";
  const emptyForm = { roomLabel: isAdmin ? "" : user.roomLabel, studentName: "", category: "", description: "", priority: "Medium" };
  const [tab, setTab] = useState("unresolved");
  const [all, setAll] = useState([]);
  const [unresolved, setUnresolved] = useState({ total: 0, groups: [] });
  const [filters, setFilters] = useState({ status: "", priority: "", category: "", q: "" });
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);

  const flash = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  };

  const refresh = useCallback(async () => {
    try {
      const [list, unres] = await Promise.all([api.list(filters), api.unresolved()]);
      setAll(list);
      setUnresolved(unres);
    } catch (e) { flash(e.message, "err"); }
  }, [filters]);

  useEffect(() => { refresh(); }, [refresh]);

  const act = async (fn, msg) => {
    try { await fn(); flash(msg); refresh(); return true; } catch (e) { flash(e.message, "err"); return false; }
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = isAdmin ? form : { category: form.category, description: form.description, roomLabel: form.roomLabel };
    if (await act(() => api.create(payload), `Request for ${(form.roomLabel || user.roomLabel).toUpperCase()} submitted`)) setForm(emptyForm);
  };

  const counts = Object.fromEntries(unresolved.groups.map((g) => [g.priority, g.items.length]));

  return (
    <div className="app">
      <header>
        <div>
          <h1>🛠️ Hostel Maintenance Tracker</h1>
          <p className="sub">Fictional data · Blocks A–D</p>
        </div>
        <div className="stats">
          {meta.priorities.map((p) => (
            <div key={p} className={`stat p-${slug(p)}`}><b>{counts[p] ?? 0}</b><span>{p}</span></div>
          ))}
        </div>
        <div className="userbox">
          <div>
            <b>{user.name}</b>
            <span className={`role role-${user.role}`}>{isAdmin ? "Admin" : `Student · ${user.roomLabel}`}</span>
          </div>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <main>
        <section className="card form-card">
          <h2>{isAdmin ? "Log a request" : "Report a problem"}</h2>
          <form onSubmit={submit}>
            {isAdmin ? (
              <>
                <label>Room label*
                  <input required placeholder="e.g. B-214" value={form.roomLabel} onChange={(e) => setForm({ ...form, roomLabel: e.target.value })} />
                </label>
                <label>Student name
                  <input placeholder="Optional" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
                </label>
              </>
            ) : (
              <label className="full">Room label*
                <input required value={form.roomLabel} onChange={(e) => setForm({ ...form, roomLabel: e.target.value })} />
              </label>
            )}
            <label className={isAdmin ? "" : "full"}>Issue category*
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select…</option>
                {meta.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            {isAdmin && (
              <label>Priority
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {meta.priorities.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            )}
            <label className="full">Description*
              <textarea required minLength={5} rows={3} placeholder="What's wrong?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            {!isAdmin && <p className="hint full">The warden sets the priority after reviewing your request.</p>}
            <button className="primary full" type="submit">Submit request</button>
          </form>
        </section>

        <section className="card list-card">
          <nav className="tabs">
            <button className={tab === "unresolved" ? "active" : ""} onClick={() => setTab("unresolved")}>
              {isAdmin ? "Unresolved by priority" : "My pending"} <span className="pill">{unresolved.total}</span>
            </button>
            <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
              {isAdmin ? "All requests" : "My requests"} <span className="pill">{all.length}</span>
            </button>
          </nav>

          {tab === "unresolved" ? (
            <div className="groups">
              {unresolved.total === 0 && <p className="empty">Nothing pending 🎉</p>}
              {unresolved.groups.filter((g) => g.items.length).map((g) => (
                <div key={g.priority} className="group">
                  <h3 className={`g-head p-${slug(g.priority)}`}>{g.priority} <span>({g.items.length})</span></h3>
                  {g.items.map((r) => <RequestRow key={r._id} r={r} meta={meta} act={act} isAdmin={isAdmin} />)}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="filters">
                <input placeholder={isAdmin ? "Search room, student, text…" : "Search my requests…"} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
                {[["status", "statuses"], ["priority", "priorities"], ["category", "categories"]].map(([k, plural]) => (
                  <select key={k} value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
                    <option value="">All {plural}</option>
                    {meta[plural].map((v) => <option key={v}>{v}</option>)}
                  </select>
                ))}
              </div>
              {all.length === 0 && <p className="empty">No requests match.</p>}
              {all.map((r) => <RequestRow key={r._id} r={r} meta={meta} act={act} isAdmin={isAdmin} />)}
            </>
          )}
        </section>
      </main>

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}

function RequestRow({ r, meta, act, isAdmin }) {
  const closed = r.status === "Closed";
  const [mode, setMode] = useState(null); // null | "resolve" | "close"
  const [note, setNote] = useState("");

  const confirm = async () => {
    const done = mode === "resolve"
      ? await act(() => api.resolve(r._id, note), `${r.roomLabel} marked resolved`)
      : await act(() => api.close(r._id, note), `${r.roomLabel} request closed`);
    if (done) { setMode(null); setNote(""); }
  };

  return (
    <article className={`row ${closed ? "closed" : ""}`}>
      <div className="row-body">
        <div className="row-main">
          <div className="row-top">
            <span className="room">{r.roomLabel}</span>
            <span className="cat">{r.category}</span>
            <span className={`badge p-${slug(r.priority)}`}>{r.priority}</span>
            <span className={`badge s-${slug(r.status)}`}>{r.status}</span>
          </div>
          <p className="desc">{r.description}</p>
          {r.resolutionNote && <p className="resolution">✅ <b>Fix:</b> {r.resolutionNote}</p>}
          <p className="metaline">
            {isAdmin && r.studentName && <>{r.studentName} · </>}Reported {fmt(r.createdAt)}
            {r.resolvedAt && <> · Resolved {fmt(r.resolvedAt)}</>}
            {r.closedAt && <> · Closed {fmt(r.closedAt)}</>}
          </p>
        </div>
        {isAdmin && !closed && !mode && (
          <div className="row-actions">
            <select title="Set priority" value={r.priority} onChange={(e) => act(() => api.setPriority(r._id, e.target.value), `${r.roomLabel} priority → ${e.target.value}`)}>
              {meta.priorities.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select title="Update status" value={r.status} onChange={(e) => act(() => api.setStatus(r._id, e.target.value), `${r.roomLabel} status → ${e.target.value}`)}>
              <option>Open</option>
              <option>In Progress</option>
              <option disabled={r.status !== "Resolved"}>Resolved</option>
            </select>
            {r.status !== "Resolved" && <button className="success" onClick={() => setMode("resolve")}>Resolve</button>}
            <button className="danger" onClick={() => setMode("close")}>Close</button>
          </div>
        )}
      </div>
      {mode && (
        <div className="note-box">
          <input
            autoFocus
            placeholder={mode === "resolve" ? "What was fixed? (required, visible to the student)" : "Closing note (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
          />
          <button className={mode === "resolve" ? "success solid" : "danger solid"} onClick={confirm} disabled={mode === "resolve" && note.trim().length < 3}>
            {mode === "resolve" ? "Mark resolved" : "Close request"}
          </button>
          <button onClick={() => { setMode(null); setNote(""); }}>Cancel</button>
        </div>
      )}
    </article>
  );
}
