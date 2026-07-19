"use client";
import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { query, command } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, Pager, Modal, toast, fmtDate } from "@/components/ui";
import { errorText } from "@/lib/errors";

/**
 * Certificate administration: report with date/course filters,
 * revoke, and admin (re-)issue with a corrected name (stable uid,
 * version increments).
 */
export default function AdminCertificatesPage() {
  const [page, setPage] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reissueOpen, setReissueOpen] = useState(false);

  const courses = useAsync(() => query("COURSES", { pagination: { page: 0, size: 100 } }), []);
  const { data, error, loading, reload } = useAsync(
    () => query("CERTIFICATE_REPORT", {
      filters: {
        ...(courseId ? { courseId: Number(courseId) } : {}),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      },
      pagination: { page, size: 20 },
    }), [page, courseId, fromDate, toDate]);

  const revoke = async (c) => {
    const reason = prompt(`Revoke certificate ${c.certificateCode} (${c.studentName})?\nPublic verification will report it as revoked.\nReason:`);
    if (reason === null) return;
    try {
      await command("REVOKE_CERTIFICATE", { certificateCode: c.certificateCode }, { reason: reason || undefined });
      toast("Certificate revoked.");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <Shell role="ADMIN">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Certificates</h1>
          <p className="page-sub">Issued credentials — verifiable at /verify. Revocation flips public verification to invalid.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setReissueOpen(true)}>Re-issue (name fix)</button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
          <label>Course</label>
          <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(0); }}>
            <option value="">All courses</option>
            {(courses.data?.content || []).map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Issued from</label>
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Issued to</label>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} />
        </div>
      </div>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          <div className="card">
            <table className="data">
              <thead><tr><th>Code</th><th>Student</th><th>Course</th><th>Issued</th><th /></tr></thead>
              <tbody>
                {data.content.map((c) => (
                  <tr key={c.certificateId}>
                    <td><code>{c.certificateCode}</code></td>
                    <td><b>{c.studentName}</b><br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{c.studentEmail}</span></td>
                    <td>{c.courseTitle}</td>
                    <td style={{ fontSize: 13.5 }}>{fmtDate(c.issuedAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link href={`/verify/${c.certificateCode}`} className="btn btn-ghost btn-sm">Verify</Link>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => revoke(c)}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.content.length === 0 && (
                  <tr><td colSpan={5} style={{ color: "var(--ink-soft)" }}>No certificates match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager pageData={data} onPage={setPage} />
        </>
      )}

      <ReissueModal open={reissueOpen} onClose={() => setReissueOpen(false)}
        courses={courses.data?.content || []} onDone={() => { setReissueOpen(false); reload(); }} />
    </Shell>
  );
}

function ReissueModal({ open, onClose, courses, onDone }) {
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const students = useAsync(
    () => (courseId ? query("COURSE_STUDENTS", { filters: { courseId: Number(courseId) }, pagination: { page: 0, size: 100 } }) : Promise.resolve(null)),
    [courseId]);

  const reissue = async () => {
    if (!courseId || !studentId) return toast("Pick the course and student.", "error");
    setBusy(true);
    try {
      const r = await command("ADMIN_ISSUE_CERTIFICATE", {
        studentId: Number(studentId), courseId: Number(courseId),
        recipientName: name.trim() || null,
      });
      toast(`Re-issued ${r.certificateCode} (version incremented, uid unchanged).`);
      onDone();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Admin re-issue certificate" onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 14 }}>
        Re-issues an existing certificate — typically to correct the printed name. The
        student must already hold a certificate for the course; its verification uid stays
        stable and any revocation is lifted.
      </p>
      <div className="field"><label>Course</label>
        <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setStudentId(""); }}>
          <option value="">Select…</option>
          {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
        </select></div>
      <div className="field"><label>Student</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!courseId}>
          <option value="">Select…</option>
          {(students.data?.content || []).map((s) => (
            <option key={s.studentId} value={s.studentId}>{s.name} · {s.email}</option>
          ))}
        </select></div>
      <div className="field"><label>Corrected recipient name (blank = keep current)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={reissue}>
          {busy ? "Re-issuing…" : "Re-issue certificate"}
        </button>
      </div>
    </Modal>
  );
}
