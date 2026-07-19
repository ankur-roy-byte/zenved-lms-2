"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { publicQuery } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice } from "@/components/ui";

/** Public verification result — the QR code on every certificate PDF lands here. */
export default function VerifyResultPage() {
  const { code } = useParams();
  const { data, error, loading, reload } = useAsync(
    () => publicQuery("VERIFY_CERTIFICATE", { certificateCode: String(code) }), [code]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontSize: 26, display: "block", textAlign: "center", marginBottom: 24 }}>
          Zen<span style={{ color: "var(--primary)" }}>Ved</span>
        </Link>

        {loading && <div className="card" style={{ padding: 32 }}><Spinner label="Checking certificate…" /></div>}
        <ErrorNotice error={error} onRetry={reload} />

        {data && (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            {data.valid ? (
              <>
                <div style={{ fontSize: 46 }}>✅</div>
                <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>Valid certificate</h1>
                <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginBottom: 20 }}>
                  Issued by ZenVed Innovation Center
                </p>
                <div style={{ textAlign: "left", maxWidth: 380, margin: "0 auto" }}>
                  <div className="kv"><span>Awarded to</span><b>{data.studentName}</b></div>
                  <div className="kv"><span>Programme</span><b>{data.courseTitle}</b></div>
                  <div className="kv"><span>Issued on</span><b>{data.issuedAt}</b></div>
                  <div className="kv"><span>Code</span><b><code>{data.certificateCode}</code></b></div>
                </div>
                <Link href={`/certificate/${data.certificateCode}`} className="btn btn-ghost btn-sm" style={{ marginTop: 18 }}>
                  View certificate
                </Link>
              </>
            ) : data.revoked ? (
              <>
                <div style={{ fontSize: 46 }}>🚫</div>
                <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>Certificate revoked</h1>
                <p style={{ color: "var(--ink-soft)", fontSize: 14.5 }}>
                  This certificate ({data.certificateCode}) was issued
                  {data.studentName ? <> to <b>{data.studentName}</b></> : null} for
                  {" "}<b>{data.courseTitle}</b> but has since been revoked by the institute.
                  It should not be accepted as a valid credential.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 46 }}>❌</div>
                <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>Not a valid certificate</h1>
                <p style={{ color: "var(--ink-soft)", fontSize: 14.5 }}>
                  No certificate matches <code>{String(code)}</code>. Check the code for
                  typos, or contact the institute if you believe this is an error.
                </p>
              </>
            )}
            <div style={{ marginTop: 18 }}>
              <Link href="/verify" style={{ color: "var(--primary)", fontSize: 14 }}>Verify another certificate</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
