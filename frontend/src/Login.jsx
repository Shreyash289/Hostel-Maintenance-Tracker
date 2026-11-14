import { useState } from "react";
import { api } from "./api";

// Fictional demo accounts (created by backend/seed.js).
const DEMO = {
  student: { email: "riya@hostel.test", password: "student123", label: "Riya Kapoor · A-101" },
  admin: { email: "admin@hostel.test", password: "admin123", label: "Warden Admin" },
};

export default function Login({ onLogin }) {
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
      <div className="login-card card">
        <h1>🛠️ Hostel Maintenance</h1>
        <p className="sub">Log in to report or manage room complaints</p>

        <div className="role-switch">
          <button type="button" className={role === "student" ? "active" : ""} onClick={() => switchRole("student")}>🎓 Student</button>
          <button type="button" className={role === "admin" ? "active" : ""} onClick={() => switchRole("admin")}>🛡️ Admin</button>
        </div>

        <form onSubmit={submit} className="login-form">
          {mode === "register" && (
            <>
              <label>Full name<input required value={f.name} onChange={set("name")} placeholder="e.g. Priya Sharma" /></label>
              <label>Room label<input required value={f.roomLabel} onChange={set("roomLabel")} placeholder="e.g. C-210" /></label>
            </>
          )}
          <label>Email<input required type="email" value={f.email} onChange={set("email")} placeholder="you@hostel.test" /></label>
          <label>Password<input required type="password" minLength={6} value={f.password} onChange={set("password")} placeholder="••••••" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "register" ? "Create student account" : `Log in as ${role}`}
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
        {role === "admin" && <p className="hint">Admin accounts are created by the system, not by sign-up.</p>}

        {mode === "login" && (
          <button type="button" className="demo" onClick={() => setF({ ...f, email: demo.email, password: demo.password })}>
            Use demo {role}: <b>{demo.label}</b><br /><code>{demo.email} / {demo.password}</code>
          </button>
        )}
      </div>
    </div>
  );
}
