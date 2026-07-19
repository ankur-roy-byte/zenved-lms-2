"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { publicQuery, certificateDownloadUrl } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice } from "@/components/ui";
import { IS_MOCK } from "@/lib/config";

/**
 * Printable certificate view for a certificate code. Data comes from the
 * public VERIFY_CERTIFICATE query, so the page renders only what the
 * backend certifies. In live mode the official PDF (with QR) is one
 * click away; this HTML view is a convenience rendering.
 */
export default function CertificatePage() {
  const { code } = useParams();
  const { data, error, loading, reload } = useAsync(
    () => publicQuery("VERIFY_CERTIFICATE", { certificateCode: String(code) }), [code]);

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Link href="/student" className="btn btn-ghost">← My learning</Link>
        <div style={{ display: "flex", gap: 8 }}>
          {!IS_MOCK && data?.valid && (
            <a className="btn btn-amber" href={certificateDownloadUrl(String(code))} target="_blank" rel="noreferrer">
              ⬇ Official PDF (with QR)
            </a>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        </div>
      </div>

      {loading && <Spinner label="Loading certificate…" />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && !data.valid && !data.revoked && (
        <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 560, margin: "40px auto" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <h2 style={{ fontSize: 24, margin: "10px 0" }}>Certificate not found</h2>
          <p style={{ color: "var(--ink-soft)" }}>
            No certificate exists with code <code>{String(code)}</code>.
          </p>
        </div>
      )}

      {data && data.revoked && (
        <div className="notice notice-error no-print" role="alert">
          ⚠ This certificate has been revoked by the issuing institute and is no longer valid.
        </div>
      )}

      {data && (data.valid || data.revoked) && (
        <div className="cert" style={data.revoked ? { filter: "grayscale(1)", opacity: 0.8 } : undefined}>
          <div className="seal">ZV</div>
          <div style={{ fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
            ZenVed Innovation Center
          </div>
          <h1>Certificate of Completion</h1>
          <p style={{ color: "var(--ink-soft)" }}>This is to certify that</p>
          <div className="name">{data.studentName}</div>
          <p style={{ maxWidth: 520, margin: "0 auto", color: "var(--ink-mid)" }}>
            has successfully completed the programme
            <br />
            <b style={{ fontSize: 19 }}>{data.courseTitle}</b>
            <br />
            <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>Issued {data.issuedAt}</span>
          </p>
          <div className="sig-row">
            <div className="sig">Programme Director</div>
            <div className="sig">Lead Instructor</div>
            <div className="sig">
              Certificate ID<br /><b>{data.certificateCode}</b>
              <br /><span style={{ fontSize: 11.5 }}>Verify at /verify/{data.certificateCode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
