"use client";
import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { query, command } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, StatusChip, Pager, Modal, toast, fmtDate } from "@/components/ui";
import { errorText } from "@/lib/errors";

const STATUSES = ["", "DRAFT", "IN_REVIEW", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];

/**
 * Admin course management: full lifecycle (publish / unpublish / archive /
 * soft-delete / hard-delete) + multi-instructor assignment.
 */
export default function AdminCoursesPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [assignFor, setAssignFor] = useState(null);
  const { data, error, loading, reload } = useAsync(
    () => query("COURSES", {
      filters: status ? { status } : null,
      pagination: { page, size: 20 },
    }), [page, status]);

  const act = async (label, name, payload, opts = {}) => {
    if (opts.confirmText && !confirm(opts.confirmText)) return;
    try {
      await command(name, payload, opts.reason ? { reason: opts.reason } : {});
      toast(label + " ✓");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <Shell role="ADMIN">
      <h1 className="page-title">Courses</h1>
      <p className="page-sub">Lifecycle: DRAFT → IN_REVIEW → PUBLISHED, with unpublish, archive and deletion.</p>

      <div className="tabs">
        {STATUSES.map((s) => (
          <button key={s || "all"} className={status === s ? "on" : ""}
            onClick={() => { setStatus(s); setPage(0); }}>
            {s ? s.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          <div className="card">
            <table className="data">
              <thead><tr><th>Course</th><th>Owner</th><th>Status</th><th>Created</th><th style={{ width: 330 }}>Actions</th></tr></thead>
              <tbody>
                {data.content.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <b>{c.title}</b>
                      <br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                        #{c.courseId} · {c.category || "General"} · <StatusChip value={c.courseType} />
                      </span>
                    </td>
                    <td>{c.instructorName}</td>
                    <td><StatusChip value={c.status} /></td>
                    <td style={{ fontSize: 13.5 }}>{fmtDate(c.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(c.status === "DRAFT" || c.status === "IN_REVIEW" || c.status === "UNPUBLISHED") && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => act("Published", "PUBLISH_COURSE", { courseId: c.courseId })}>
                            Publish
                          </button>
                        )}
                        {c.status === "PUBLISHED" && (
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => act("Unpublished", "UNPUBLISH_COURSE", { courseId: c.courseId })}>
                            Unpublish
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setAssignFor(c)}>Instructors</button>
                        {c.status !== "ARCHIVED" && (
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => act("Archived", "ARCHIVE_COURSE", { courseId: c.courseId },
                              { confirmText: `Archive “${c.title}”? Students keep access records but the course leaves the catalog.` })}>
                            Archive
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                          onClick={() => act("Soft-deleted (60-day grace)", "SOFT_DELETE_COURSE", { courseId: c.courseId },
                            { confirmText: `Soft-delete “${c.title}”? It disappears immediately and is hard-deleted after the grace period. Certificates are retained.` })}>
                          Soft-delete
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                          onClick={() => act("Hard-deleted", "DELETE_COURSE", { courseId: c.courseId },
                            { confirmText: `Hard-delete “${c.title}”? Only possible with no enrollments/certificates.` })}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.content.length === 0 && (
                  <tr><td colSpan={5} style={{ color: "var(--ink-soft)" }}>No courses in this state.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager pageData={data} onPage={setPage} />
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
            Content editing happens in the <Link href="/instructor" style={{ color: "var(--primary)" }}>instructor studio</Link> —
            admins can manage any course there.
          </p>
        </>
      )}

      {assignFor && (
        <AssignInstructorsModal course={assignFor} onClose={() => setAssignFor(null)}
          onSaved={() => { setAssignFor(null); reload(); }} />
      )}
    </Shell>
  );
}

function AssignInstructorsModal({ course, onClose, onSaved }) {
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const list = emails.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    setBusy(true);
    try {
      const r = await command("ASSIGN_INSTRUCTORS", { courseId: course.courseId, instructorEmails: list });
      const pending = (r.instructors || []).filter((i) => i.accountStatus === "PENDING_APPROVAL").length;
      toast(`Assigned ${r.instructors.length} co-instructor(s)${pending ? ` — ${pending} pending first login` : ""}.`);
      onSaved();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Co-instructors — ${course.title}`} onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 14 }}>
        This REPLACES the assigned co-instructor set (the owner, {course.instructorName}, is
        implicit). Unknown emails become pending instructor accounts, activated on their
        first Google sign-in. Submit an empty list to remove all co-instructors.
      </p>
      <div className="field">
        <label>Instructor emails (comma or newline separated)</label>
        <textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)}
          style={{ padding: "11px 14px", border: "1px solid var(--line)", borderRadius: 10, font: "inherit", fontSize: 14.5 }}
          placeholder={"meera@zenved.in\nnew.teacher@example.com"} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Replace assignment"}
        </button>
      </div>
    </Modal>
  );
}
