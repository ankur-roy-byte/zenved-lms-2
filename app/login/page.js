"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/store";

const DEMO = [
  { role: "Admin", u: "admin", p: "admin123" },
  { role: "Instructor", u: "instructor", p: "instructor123" },
  { role: "Student", u: "abc", p: "abc" },
  { role: "Student 2", u: "student", p: "student123" },
];

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const user = login(username, password);
    if (!user) {
      setError("Invalid username or password. Try one of the demo accounts below.");
      return;
    }
    router.push(`/${user.role}`);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontSize: 26, display: "block", textAlign: "center", marginBottom: 24 }}>
          Zen<span style={{ color: "var(--primary)" }}>Ved</span>
        </Link>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Sign in</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginBottom: 22 }}>
            One portal for admins, instructors and students. Your role decides
            where you land.
          </p>
          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. abc"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 14 }}>{error}</p>
          )}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={submit}>
            Sign in →
          </button>
        </div>

        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
            Demo accounts (stored in the frontend)
          </div>
          <table className="data">
            <tbody>
              {DEMO.map((d) => (
                <tr key={d.u}>
                  <td><span className="chip chip-green">{d.role}</span></td>
                  <td><code>{d.u}</code></td>
                  <td><code>{d.p}</code></td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setUsername(d.u); setPassword(d.p); }}
                    >
                      Fill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
