"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { query } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, Pager, fmtDateTime } from "@/components/ui";

/** Admin audit trail (AUDIT_LOGS). PII in details is minimized/masked by the backend. */
export default function AdminAuditPage() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [actionDraft, setActionDraft] = useState("");

  const { data, error, loading, reload } = useAsync(
    () => query("AUDIT_LOGS", {
      filters: action ? { action } : null,
      pagination: { page, size: 25 },
    }), [page, action]);

  return (
    <Shell role="ADMIN">
      <h1 className="page-title">Audit log</h1>
      <p className="page-sub">
        Every sensitive admin/instructor action, with correlation ids. Enrollment and
        instructor commands store PII-minimized, email-masked details.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input placeholder="Filter by action, e.g. ENROLL_STUDENT" value={actionDraft}
          onChange={(e) => setActionDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setAction(actionDraft.trim().toUpperCase()); setPage(0); } }}
          style={{ flex: 1, minWidth: 240, padding: "9px 14px", border: "1px solid var(--line)", borderRadius: 10 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => { setAction(actionDraft.trim().toUpperCase()); setPage(0); }}>Filter</button>
        {action && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setAction(""); setActionDraft(""); setPage(0); }}>Clear</button>
        )}
      </div>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          <div className="card">
            <table className="data">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th><th>Request</th></tr></thead>
              <tbody>
                {data.content.map((a) => (
                  <tr key={a.auditId}>
                    <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmtDateTime(a.createdAt)}</td>
                    <td style={{ fontSize: 13.5 }}>{a.actorEmail || `#${a.actorId}`}</td>
                    <td><code style={{ fontSize: 12.5 }}>{a.action}</code></td>
                    <td style={{ fontSize: 13, color: "var(--ink-soft)", maxWidth: 380, overflowWrap: "anywhere" }}>{a.details}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>{a.requestId}</td>
                  </tr>
                ))}
                {data.content.length === 0 && (
                  <tr><td colSpan={5} style={{ color: "var(--ink-soft)" }}>No audit entries match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager pageData={data} onPage={setPage} />
        </>
      )}
    </Shell>
  );
}
