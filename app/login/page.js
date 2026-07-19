"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginPassword, loginGoogle, roleHome } from "@/lib/api";
import { IS_MOCK, GOOGLE_CLIENT_ID } from "@/lib/config";
import { errorText } from "@/lib/errors";

/** Demo identities available in mock mode. Google sign-in is mocked with
 *  the backend local-profile token format: "mock:<email>:<name>". */
const MOCK_GOOGLE_PERSONAS = [
  { label: "Ananya (student — course completed)", email: "ananya@student.in", name: "Ananya Kulkarni" },
  { label: "Vikram (student — mid-course)", email: "vikram@student.in", name: "Vikram Rao" },
  { label: "Sara (student — pending invite)", email: "sara@student.in", name: "Sara Fernandes" },
  { label: "Rahul (instructor)", email: "rahul@zenved.in", name: "Rahul Menon" },
  { label: "Meera (co-instructor)", email: "meera@zenved.in", name: "Meera Iyer" },
  { label: "Priya (admin — via allowlist)", email: "admin@lms.local", name: "Priya Nair" },
  { label: "Unknown user (rejected — not enrolled)", email: "stranger@example.com", name: "Stranger" },
];

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleBtnRef = useRef(null);

  const finish = (auth) => router.replace(roleHome(auth.user));

  const submitPassword = async () => {
    if (!email || !password) return setError("Enter your email and password.");
    setBusy(true); setError("");
    try {
      finish(await loginPassword(email.trim(), password));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const mockGoogle = async (persona) => {
    setBusy(true); setError("");
    try {
      finish(await loginGoogle(`mock:${persona.email}:${persona.name}`));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Live mode: real Google Identity Services button.
  useEffect(() => {
    if (IS_MOCK || !GOOGLE_CLIENT_ID) return;
    const render = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setBusy(true); setError("");
          try {
            finish(await loginGoogle(response.credential));
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline", size: "large", width: 336, text: "continue_with",
      });
    };
    if (window.google?.accounts?.id) { render(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontSize: 26, display: "block", textAlign: "center", marginBottom: 24 }}>
          Zen<span style={{ color: "var(--primary)" }}>Ved</span>
        </Link>

        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Sign in</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginBottom: 22 }}>
            Students and instructors sign in with Google. Admins can also use email &amp; password.
          </p>

          {/* Google sign-in */}
          {IS_MOCK ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
                Continue with Google (demo)
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {MOCK_GOOGLE_PERSONAS.map((p) => (
                  <button key={p.email} className="btn btn-ghost btn-sm" disabled={busy}
                    style={{ justifyContent: "flex-start" }} onClick={() => mockGoogle(p)}>
                    <span aria-hidden>ⓖ</span> {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : GOOGLE_CLIENT_ID ? (
            <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center", marginBottom: 20 }} />
          ) : (
            <div className="notice" style={{ marginBottom: 20 }}>
              Google sign-in is not configured — set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
              Admin email/password login still works below.
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 18px", color: "var(--ink-soft)", fontSize: 13 }}>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} /> or <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@lms.local"
              autoComplete="username" onKeyDown={(e) => e.key === "Enter" && submitPassword()} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && submitPassword()} />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 14 }} role="alert">{error}</p>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
            disabled={busy} onClick={submitPassword}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </div>

        {IS_MOCK && (
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              Demo mode
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
              Running on seeded in-browser data — no backend needed. Admin password login:
              {" "}<code>admin@lms.local</code> / <code>Admin@12345</code>. Point
              {" "}<code>NEXT_PUBLIC_API_MODE=live</code> +
              {" "}<code>NEXT_PUBLIC_API_BASE_URL</code> at the Spring Boot backend to go live —
              demo data is disabled automatically in production builds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
