"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Public certificate verification — enter a code or scan a QR that lands on /verify/[code]. */
export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const go = () => {
    const trimmed = code.trim();
    if (trimmed) router.push("/verify/" + encodeURIComponent(trimmed));
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontSize: 26, display: "block", textAlign: "center", marginBottom: 24 }}>
          Zen<span style={{ color: "var(--primary)" }}>Ved</span>
        </Link>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Verify a certificate</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginBottom: 20 }}>
            Enter the certificate code (e.g. <code>CERT-2026-000061</code>) or the
            verification id printed under the QR code. No sign-in needed.
          </p>
          <div className="field">
            <label>Certificate code or verification id</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="CERT-YYYY-NNNNNN" onKeyDown={(e) => e.key === "Enter" && go()} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={go}>
            Verify →
          </button>
        </div>
      </div>
    </div>
  );
}
