import { useCallback, useEffect, useState } from "react";
import { api, auth } from "./api";
import Login from "./Login.jsx";

export const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
const fmt = (d) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const CAT_ICON = { Electrical: "⚡", Plumbing: "🚿", Furniture: "🪑", Cleaning: "🧹", Internet: "📶", "Pest Control": "🪳", Other: "🧩" };
const PRIO_ICON = { Critical: "🔥", High: "⚠️", Medium: "🔔", Low: "🌿" };
const STEPS = ["Open", "In Progress", "Resolved", "Closed"];
const H = 36e5;
const OVERDUE_H = { Critical: 24, High: 48, Medium: 96, Low: 168 }; // same targets as the server

function ago(d) {
  const h = (Date.now() - new Date(d)) / H;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const isOverdue = (r) => ["Open", "In Progress"].includes(r.status) && (Date.now() - new Date(r.createdAt)) / H > OVERDUE_H[r.priority];
const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ---------- theme (light / dark), remembered per browser ----------
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("hmt_theme") || ""; } catch { return ""; }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem("hmt_theme", theme) : localStorage.removeItem("hmt_theme"); } catch {}
  }, [theme]);
  const dark = theme ? theme === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return [dark, () => setTheme(dark ? "light" : "dark")];
}

export function ThemeToggle({ dark, toggle }) {
  return (
    <button className="icon-btn" onClick={toggle} title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle theme">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!auth.token);
  const [meta, setMeta] = useState({ categories: [], priorities: [], statuses: [] });
  const [dark, toggleTheme] = useTheme();

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    if (auth.token) api.me().then((r) => setUser(r.user)).catch(() => (auth.token = null)).finally(() => setChecking(false));
    const onLogout = () => setUser(null);
    window.addEventListener("hmt-logout", onLogout);
    return () => window.removeEventListener("hmt-logout", onLogout);
  }, []);

  const onLogin = ({ token, user }) => { auth.token = token; setUser(user); };
  const logout = () => { auth.token = null; setUser(null); };

  if (checking) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Login onLogin={onLogin} dark={dark} toggleTheme={toggleTheme} />;
  return <Dashboard key={user.id} user={user} meta={meta} logout={logout} dark={dark} toggleTheme={toggleTheme} />;
}

function Dashboard({ user, meta, logout, dark, toggleTheme }) {
  const isAdmin = user.role === "admin";
  const emptyForm = { roomLabel: "", studentName: "", category: "", description: "", priority: "Medium" };
  const [tab, setTab] = useState("unresolved");
  const [all, setAll] = useState([]);
  const [unresolved, setUnresolved] = useState({ total: 0, groups: [] });
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ status: "", priority: "", category: "", q: "" });
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);

  const flash = (msg, kind = "ok") => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(null), 2800);
  };

  const refresh = useCallback(async () => {
    try {
      const [list, unres, st] = await Promise.all([api.list(filters), api.unresolved(), api.stats()]);
      setAll(list);
      setUnresolved(unres);
      setStats(st);
    } catch (e) { flash(e.message, "err"); }
  }, [filters]);

  useEffect(() => { refresh(); }, [refresh]);

  const act = async (fn, msg) => {
    try { await fn(); flash(msg); refresh(); return true; } catch (e) { flash(e.message, "err"); return false; }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.category) return flash("Pick an issue category", "err");
    // Students never send a room: the server takes it from their account.
    const payload = isAdmin ? form : { category: form.category, description: form.description };
    const room = isAdmin ? form.roomLabel.toUpperCase() : user.roomLabel;
    if (await act(() => api.create(payload), `Request for ${room} submitted`)) setForm(emptyForm);
  };

  const counts = Object.fromEntries(unresolved.groups.map((g) => [g.priority, g.items.length]));
  const tabs = [
    ["unresolved", isAdmin ? "Unresolved by priority" : "My pending", unresolved.total],
    ["all", isAdmin ? "All requests" : "My requests", all.length],
    ...(isAdmin ? [["insights", "Insights", null]] : []),
  ];

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <div className="brand">
            <div className="logo">🛠️</div>
            <div>
              <h1>Hostel Maintenance Tracker</h1>
              <p className="sub">{greeting()}, {user.name.split(" ")[0]} 👋</p>
            </div>
          </div>
          <div className="userbox">
            <ThemeToggle dark={dark} toggle={toggleTheme} />
            <div className="avatar">{initials(user.name)}</div>
            <div className="who">
              <b>{user.name}</b>
              <span>{isAdmin ? "🛡️ Warden · Admin" : `🎓 Student · Room ${user.roomLabel}`}</span>
            </div>
            <button className="ghost" onClick={logout}>Log out</button>
          </div>
        </div>
        <div className="stats">
          {meta.priorities.map((p) => (
            <div key={p} className={`stat p-${slug(p)}`}>
              <span className="stat-icon">{PRIO_ICON[p]}</span>
              <div><b>{counts[p] ?? 0}</b><span>{p}</span></div>
            </div>
          ))}
          {stats && (
            <div className="stat stat-overdue">
              <span className="stat-icon">⏰</span>
              <div><b>{stats.overdue}</b><span>Overdue</span></div>
            </div>
          )}
        </div>
      </header>

      <main>
        <section className="card form-card">
          <h2>{isAdmin ? "Log a request" : "Report a problem"}</h2>
          <p className="card-sub">{isAdmin ? "Raise a complaint on behalf of any room." : "Tell the warden what needs fixing."}</p>
          <form onSubmit={submit}>
            {isAdmin ? (
              <>
                <label>Room*
                  <input required placeholder="e.g. B-214" value={form.roomLabel} onChange={(e) => setForm({ ...form, roomLabel: e.target.value })} />
                </label>
                <label>Student name
                  <input placeholder="Optional" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
                </label>
              </>
            ) : (
              <div className="room-lock full" title="Taken from your account, so complaints always go to the right room">
                <span className="room-lock-icon">🔒</span>
                <div>
                  <span className="room-lock-label">Your room</span>
                  <b>{user.roomLabel}</b>
                </div>
                <span className="room-lock-tag">From your account</span>
              </div>
            )}

            <div className="full">
              <span className="field-label">Issue category*</span>
              <div className="cat-grid">
                {meta.categories.map((c) => (
                  <button type="button" key={c} className={`cat-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>
                    <span>{CAT_ICON[c]}</span>{c}
                  </button>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="full">
                <span className="field-label">Priority</span>
                <div className="seg">
                  {meta.priorities.map((p) => (
                    <button type="button" key={p} className={`seg-btn p-${slug(p)} ${form.priority === p ? "active" : ""}`} onClick={() => setForm({ ...form, priority: p })}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            <label className="full">Description*
              <textarea required minLength={5} maxLength={500} rows={4} placeholder="What's wrong? Where exactly? Since when?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <span className="counter">{form.description.length}/500</span>
            </label>
            {!isAdmin && <p className="hint full">💡 The warden sets the priority after reviewing your request. You can withdraw it while it is still Open.</p>}
            <button className="primary full" type="submit">Submit request →</button>
          </form>
        </section>

        <section className="card list-card">
          <nav className="tabs">
            {tabs.map(([key, label, n]) => (
              <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
                {label} {n !== null && <span className="pill">{n}</span>}
              </button>
            ))}
          </nav>

          {tab === "unresolved" && (
            <div className="groups">
              {unresolved.total === 0 && <Empty icon="🎉" text="Nothing pending. All clear!" />}
              {unresolved.groups.filter((g) => g.items.length).map((g) => (
                <div key={g.priority} className="group">
                  <h3 className={`g-head p-${slug(g.priority)}`}>{PRIO_ICON[g.priority]} {g.priority} <span>({g.items.length})</span></h3>
                  {g.items.map((r) => <RequestRow key={r._id} r={r} meta={meta} act={act} isAdmin={isAdmin} />)}
                </div>
              ))}
            </div>
          )}

          {tab === "all" && (
            <>
              <div className="filters">
                <div className="search">
                  <span>🔍</span>
                  <input placeholder={isAdmin ? "Search room, student, text…" : "Search my requests…"} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
                </div>
                {[["status", "statuses"], ["priority", "priorities"], ["category", "categories"]].map(([k, plural]) => (
                  <select key={k} value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
                    <option value="">All {plural}</option>
                    {meta[plural].map((v) => <option key={v}>{v}</option>)}
                  </select>
                ))}
              </div>
              {all.length === 0 && <Empty icon="🗂️" text="No requests match." />}
              {all.map((r) => <RequestRow key={r._id} r={r} meta={meta} act={act} isAdmin={isAdmin} />)}
            </>
          )}

          {tab === "insights" && stats && <Insights stats={stats} />}
        </section>
      </main>

      {toast && <div key={toast.id} className={`toast ${toast.kind}`}>{toast.kind === "err" ? "⚠️" : "✨"} {toast.msg}</div>}
    </div>
  );
}

function Empty({ icon, text }) {
  return <div className="empty"><span>{icon}</span><p>{text}</p></div>;
}

function Insights({ stats }) {
  const maxCat = Math.max(1, ...Object.values(stats.byCategory));
  const done = stats.byStatus.Resolved + stats.byStatus.Closed;
  const pct = stats.total ? Math.round((done / stats.total) * 100) : 0;
  return (
    <div className="insights">
      <div className="kpis">
        <div className="kpi"><span>Total requests</span><b>{stats.total}</b></div>
        <div className="kpi"><span>Resolution rate</span><b>{pct}%</b><div className="meter"><i style={{ width: `${pct}%` }} /></div></div>
        <div className="kpi"><span>Avg. time to resolve</span><b>{stats.avgResolveHours === null ? "–" : stats.avgResolveHours < 48 ? `${stats.avgResolveHours}h` : `${Math.round(stats.avgResolveHours / 24)}d`}</b></div>
        <div className="kpi"><span>Student rating</span><b>{stats.avgRating ?? "–"}<small> ★</small></b><em>{stats.ratingCount} rating{stats.ratingCount === 1 ? "" : "s"}</em></div>
      </div>

      <div className="insight-cols">
        <div className="panel">
          <h4>By status</h4>
          {STEPS.map((s) => (
            <div key={s} className="status-line">
              <span className={`dot s-${slug(s)}`} />{s}<b>{stats.byStatus[s]}</b>
            </div>
          ))}
        </div>
        <div className="panel">
          <h4>By category</h4>
          {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
            <div key={c} className="bar-row">
              <span className="bar-label">{CAT_ICON[c]} {c}</span>
              <div className="bar"><i style={{ width: `${(n / maxCat) * 100}%` }} /></div>
              <b>{n}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stepper({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <li key={s} className={i < idx ? "done" : i === idx ? "current" : ""}>
          <span className="step-dot">{i < idx ? "✓" : i + 1}</span>
          <span className="step-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Stars({ value, onPick }) {
  const [hover, setHover] = useState(0);
  return (
    <span className={`stars ${onPick ? "pickable" : ""}`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} disabled={!onPick} className={(hover || value) >= n ? "on" : ""}
          onMouseEnter={() => onPick && setHover(n)} onClick={() => onPick?.(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>★</button>
      ))}
    </span>
  );
}

function RequestRow({ r, meta, act, isAdmin }) {
  const closed = r.status === "Closed";
  const [mode, setMode] = useState(null); // null | "resolve" | "close" | "withdraw" | "rate"
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const overdue = isOverdue(r);
  const canRate = !isAdmin && ["Resolved", "Closed"].includes(r.status) && !r.rating;

  const reset = () => { setMode(null); setNote(""); setRating(0); };
  const confirm = async () => {
    const ops = {
      resolve: () => act(() => api.resolve(r._id, note), `${r.roomLabel} marked resolved`),
      close: () => act(() => api.close(r._id, note), `${r.roomLabel} request closed`),
      withdraw: () => act(() => api.withdraw(r._id), "Request withdrawn"),
      rate: () => act(() => api.rate(r._id, rating, note), "Thanks for the feedback!"),
    };
    if (await ops[mode]()) reset();
  };

  return (
    <article className={`row p-${slug(r.priority)} ${closed ? "closed" : ""}`}>
      <div className="row-body">
        <div className="cat-icon" title={r.category}>{CAT_ICON[r.category]}</div>
        <div className="row-main">
          <div className="row-top">
            <span className="room">{r.roomLabel}</span>
            <span className="cat">{r.category}</span>
            <span className={`badge p-${slug(r.priority)}`}>{r.priority}</span>
            <span className={`badge s-${slug(r.status)}`}>{r.status}</span>
            {overdue && <span className="badge overdue">⏰ Overdue</span>}
          </div>
          <p className="desc">{r.description}</p>
          <Stepper status={r.status} />
          {r.resolutionNote && <p className="resolution">✅ <b>Fix:</b> {r.resolutionNote}</p>}
          {r.rating && (
            <p className="rated"><Stars value={r.rating} /> {r.feedback && <span>“{r.feedback}”</span>}</p>
          )}
          <p className="metaline">
            {isAdmin && r.studentName && <><b>{r.studentName}</b> · </>}
            <span title={fmt(r.createdAt)}>Reported {ago(r.createdAt)}</span>
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
            {r.status !== "Resolved" && <button className="success" onClick={() => setMode("resolve")}>✓ Resolve</button>}
            <button className="danger" onClick={() => setMode("close")}>Close</button>
          </div>
        )}
        {!isAdmin && !mode && (r.status === "Open" || canRate) && (
          <div className="row-actions">
            {r.status === "Open" && <button className="danger" onClick={() => setMode("withdraw")}>Withdraw</button>}
            {canRate && <button className="accent" onClick={() => setMode("rate")}>★ Rate fix</button>}
          </div>
        )}
      </div>

      {mode === "withdraw" && (
        <div className="note-box">
          <span className="note-q">Withdraw this request? This can't be undone.</span>
          <button className="danger solid" onClick={confirm}>Yes, withdraw</button>
          <button onClick={reset}>Cancel</button>
        </div>
      )}
      {mode === "rate" && (
        <div className="note-box">
          <Stars value={rating} onPick={setRating} />
          <input placeholder="Any feedback? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="accent solid" disabled={!rating} onClick={confirm}>Submit</button>
          <button onClick={reset}>Cancel</button>
        </div>
      )}
      {(mode === "resolve" || mode === "close") && (
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
          <button onClick={reset}>Cancel</button>
        </div>
      )}
    </article>
  );
}
