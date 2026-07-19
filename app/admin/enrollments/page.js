"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { query, command } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, StatusChip, Pager, Modal, toast, fmtDate } from "@/components/ui";
import { errorText } from "@/lib/errors";

/**
 * Admin enrollment machinery: enroll by email (invite), bulk enroll,
 * unenroll, and the pending-vs-active view (pending = the invited
 * student's account is still PENDING_APPROVAL until first login).
 */
export default function AdminEnrollmentsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const courses = useAsync(() => query("COURSES", { pagination: { page: 0, size: 100 } }), []);
  const { data, error, loading, reload } = useAsync(
    () => query("ENROLLMENTS", {
      filters: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(emailFilter ? { studentEmail: emailFilter } : {}),
      },
      pagination: { page, size: 20 },
    }), [page, statusFilter, emailFilter]);

  const unenroll = async (e) => {
    const reason = prompt(`Unenroll ${e.studentName} from “${e.courseTitle}”?\nReason (optional):`);
    if (reason === null) return;
    try {
      await command("UNENROLL_STUDENT", { studentId: e.studentId, courseId: e.courseId, reason: reason || null }, { reason: reason || undefined });
      toast("Student unenrolled.");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <Shell role="ADMIN">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Enrollments</h1>
          <p className="page-sub">Paid courses are invite-only: enroll by email and the course appears when that Google account signs in.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setBulkOpen(true)}>Bulk enroll</button>
          <button className="btn btn-primary" onClick={() => setEnrollOpen(true)}>+ Enroll student</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input placeholder="Filter by student email…" value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setEmailFilter(emailDraft.trim()); setPage(0); } }}
          style={{ flex: 1, minWidth: 220, padding: "9px 14px", border: "1px solid var(--line)", borderRadius: 10 }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 10 }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="UNENROLLED">UNENROLLED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { setEmailFilter(emailDraft.trim()); setPage(0); }}>Filter</button>
      </div>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          <div className="card">
            <table className="data">
              <thead><tr><th>Student</th><th>Course</th><th>Status</th><th>Access window</th><th>Payment</th><th /></tr></thead>
              <tbody>
                {data.content.map((e) => (
                  <tr key={e.enrollmentId}>
                    <td><b>{e.studentName}</b><br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{e.studentEmail}</span></td>
                    <td>{e.courseTitle}</td>
                    <td><StatusChip value={e.status} /></td>
                    <td style={{ fontSize: 13.5 }}>
                      {fmtDate(e.accessStartDate)} → {e.accessEndDate ? fmtDate(e.accessEndDate) : "open"}
                    </td>
                    <td style={{ fontSize: 13.5 }}>
                      {e.paymentMode || "—"}{e.paymentReference ? <><br /><code style={{ fontSize: 12 }}>{e.paymentReference}</code></> : null}
                    </td>
                    <td>
                      {e.status === "ACTIVE" && (
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => unenroll(e)}>
                          Unenroll
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.content.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--ink-soft)" }}>No enrollments match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager pageData={data} onPage={setPage} />
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
            An enrollment is a <b>pending invite</b> while the student's account status is
            PENDING_APPROVAL (see <a href="/admin/users" style={{ color: "var(--primary)" }}>Users</a>) —
            it activates automatically on their first Google sign-in.
          </p>
        </>
      )}

      <EnrollModal open={enrollOpen} onClose={() => setEnrollOpen(false)}
        courses={courses.data?.content || []} onDone={() => { setEnrollOpen(false); reload(); }} />
      <BulkEnrollModal open={bulkOpen} onClose={() => setBulkOpen(false)}
        courses={courses.data?.content || []} onDone={() => { setBulkOpen(false); reload(); }} />
    </Shell>
  );
}

function EnrollModal({ open, onClose, courses, onDone }) {
  const [form, setForm] = useState({ studentEmail: "", studentName: "", courseId: "",
    accessStartDate: "", accessEndDate: "", paymentMode: "OFFLINE", paymentReference: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const enroll = async () => {
    if (!form.studentEmail.trim() || !form.courseId) return toast("Student email and course are required.", "error");
    setBusy(true);
    try {
      const r = await command("ENROLL_STUDENT", {
        studentEmail: form.studentEmail.trim(),
        studentName: form.studentName || null,
        courseId: Number(form.courseId),
        accessStartDate: form.accessStartDate || null,
        accessEndDate: form.accessEndDate || null,
        paymentMode: form.paymentMode || null,
        paymentReference: form.paymentReference || null,
        notes: form.notes || null,
      });
      toast(r.studentAccountStatus === "PENDING_APPROVAL"
        ? "Invite created — the student activates on first Google login."
        : "Student enrolled.");
      onDone();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Enroll a student" onClose={onClose}>
      <div className="field"><label>Student email (their Google account)</label>
        <input value={form.studentEmail} onChange={set("studentEmail")} placeholder="student@example.com" /></div>
      <div className="field"><label>Student name (for new accounts)</label>
        <input value={form.studentName} onChange={set("studentName")} /></div>
      <div className="field"><label>Course</label>
        <select value={form.courseId} onChange={set("courseId")}>
          <option value="">Select…</option>
          {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title} ({c.status})</option>)}
        </select></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Access from</label>
          <input type="date" value={form.accessStartDate} onChange={set("accessStartDate")} /></div>
        <div className="field"><label>Access until (blank = open)</label>
          <input type="date" value={form.accessEndDate} onChange={set("accessEndDate")} /></div>
        <div className="field"><label>Payment mode</label>
          <select value={form.paymentMode} onChange={set("paymentMode")}>
            <option value="OFFLINE">OFFLINE (invoice/bank)</option>
            <option value="ONLINE">ONLINE (external gateway)</option>
            <option value="FREE">FREE (fee waived)</option>
          </select></div>
        <div className="field"><label>Payment reference</label>
          <input value={form.paymentReference} onChange={set("paymentReference")} placeholder="INV-2026-051" /></div>
      </div>
      <div className="field"><label>Notes</label><input value={form.notes} onChange={set("notes")} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={enroll}>
          {busy ? "Enrolling…" : "Enroll student"}
        </button>
      </div>
    </Modal>
  );
}

function BulkEnrollModal({ open, onClose, courses, onDone }) {
  const [courseId, setCourseId] = useState("");
  const [listText, setListText] = useState("");
  const [busy, setBusy] = useState(false);

  const parse = () => listText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [a, b] = line.split(",").map((x) => x?.trim());
    return b ? { name: a, email: b } : { name: null, email: a };
  });

  const enroll = async () => {
    const students = parse();
    if (!courseId || students.length === 0) return toast("Pick a course and add at least one line.", "error");
    if (students.length > 200) return toast("At most 200 students per bulk request.", "error");
    setBusy(true);
    try {
      const r = await command("BULK_ENROLL_STUDENTS", { courseId: Number(courseId), students });
      toast(`Enrolled ${r.enrolled} of ${r.requested} students.`);
      onDone();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Bulk enroll students" onClose={onClose}>
      <div className="field"><label>Course</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Select…</option>
          {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
        </select></div>
      <div className="field">
        <label>Students — one per line: <code>Name, email</code> or just <code>email</code> (max 200)</label>
        <textarea rows={8} value={listText} onChange={(e) => setListText(e.target.value)}
          style={{ padding: "11px 14px", border: "1px solid var(--line)", borderRadius: 10, font: "inherit", fontSize: 14 }}
          placeholder={"Ravi Kumar, ravi@example.com\npriyanka@example.com"} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={enroll}>
          {busy ? "Enrolling…" : `Enroll ${parse().length || ""} students`}
        </button>
      </div>
    </Modal>
  );
}
