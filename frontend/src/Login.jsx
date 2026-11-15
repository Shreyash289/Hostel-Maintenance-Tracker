import { useState } from "react";
import { api } from "./api";
import { ThemeToggle } from "./App.jsx";

// Fictional demo accounts (created by backend/seed.js).
const DEMO = {
  student: { email: "riya@hostel.test", password: "student123", label: "Riya Kapoor · A-101" },
  admin: { email: "admin@hostel.test", password: "admin123", label: "Warden Admin" },
};

const FEATURES = [
  ["🔒", "Room-locked complaints", "Every request is tied to the room on your account."],
  ["🔥", "Priority triage", "Critical issues jump to the top of the warden's queue."],
  ["📍", "Live progress", "Track Open → In Progress → Resolved → Closed."],
  ["⭐", "Rate the fix", "Tell the warden how well it was handled."],
];

export default function Login({ onLogin, dark, toggleTheme }) {
  const [role, setRole] = useState("student");
  const [mode, setMode] = useState("login"); // login | register
  const [f, setF] = useState({ name: "", email: "", password: "", roomLabel: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const switchRole = (r) => { setRole(r); setMode("login"); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = mode === "register" ? await api.register(f) : await api.login(f.email, f.password, role);
      onLogin(res);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const demo = DEMO[role];

  return (
    <div className="login-wrap">
      <div className="login-shell">
        <aside className="login-art">
          <div className="logo big">🛠️</div>
          <h1>Hostel Maintenance Tracker</h1>
          <p>Report a broken fan, a leaking tap or flaky Wi-Fi in seconds, and watch it get fixed.</p>
          <ul>
            {FEATURES.map(([icon, title, text]) => (
              <li key={title}><span>{icon}</span><div><b>{title}</b><small>{text}</small></div></li>
            ))}
          </ul>
          <div className="orb o1" /><div className="orb o2" />
        </aside>

        <div className="login-card">
          <div className="login-head">
            <div>
              <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>
              <p className="sub">{mode === "register" ? "Sign up with the room you live in." : "Log in to report or manage room complaints."}</p>
            </div>
            <ThemeToggle dark={dark} toggle={toggleTheme} />
          </div>

          <div className="role-switch">
            <button type="button" className={role === "student" ? "active" : ""} onClick={() => switchRole("student")}>🎓 Student</button>
            <button type="button" className={role === "admin" ? "active" : ""} onClick={() => switchRole("admin")}>🛡️ Warden</button>
          </div>

          <form onSubmit={submit} className="login-form">
            {mode === "register" && (
              <>
                <label>Full name<input required value={f.name} onChange={set("name")} placeholder="e.g. Priya Sharma" /></label>
                <label>Room
                  <input required value={f.roomLabel} onChange={set("roomLabel")} placeholder="e.g. C-210" pattern="[A-Za-z]-?\d{2,4}" title="Block letter and room number, like C-210" />
                  <small className="field-note">Your complaints will always be filed for this room.</small>
                </label>
              </>
            )}
            <label>Email<input required type="email" value={f.email} onChange={set("email")} placeholder="you@hostel.test" /></label>
            <label>Password<input required type="password" minLength={6} value={f.password} onChange={set("password")} placeholder="••••••" /></label>
            {error && <p className="form-error">⚠️ {error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create student account" : `Log in as ${role === "admin" ? "warden" : "student"} →`}
            </button>
          </form>

          {role === "student" && (
            <p className="switch-mode">
              {mode === "login" ? "New student? " : "Already have an account? "}
              <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          )}
          {role === "admin" && <p className="hint center">Warden accounts are created by the system, not by sign-up.</p>}

          {mode === "login" && (
            <button type="button" className="demo" onClick={() => setF({ ...f, email: demo.email, password: demo.password })}>
              <span className="demo-tag">Demo</span>
              <span><b>{demo.label}</b><code>{demo.email} / {demo.password}</code></span>
              <span className="demo-fill">Fill ↵</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
