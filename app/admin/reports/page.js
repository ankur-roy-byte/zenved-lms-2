"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { query } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, EmptyState, toast } from "@/components/ui";
import { errorText } from "@/lib/errors";

/** Admin reports: course analytics + per-student progress deep-dive. */
export default function AdminReportsPage() {
  const courses = useAsync(() => query("COURSES", { pagination: { page: 0, size: 100 } }), []);
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const analytics = useAsync(
    () => (courseId ? query("COURSE_ANALYTICS", { filters: { courseId: Number(courseId) } }) : Promise.resolve(null)),
    [courseId]);
  const students = useAsync(
    () => (courseId ? query("COURSE_STUDENTS", { filters: { courseId: Number(courseId) }, pagination: { page: 0, size: 100 } }) : Promise.resolve(null)),
    [courseId]);

  const runReport = async () => {
    if (!courseId || !studentId) return toast("Pick a course and a student.", "error");
    setBusy(true);
    try {
      setReport(await query("STUDENT_PROGRESS_REPORT", { filters: { courseId: Number(courseId), studentId: Number(studentId) } }));
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell role="ADMIN">
      <h1 className="page-title">Reports</h1>
      <p className="page-sub">Course-level analytics and per-student progress, straight from the tracking data.</p>

      <div className="card" style={{ padding: 18, marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ margin: 0, minWidth: 260, flex: 1 }}>
          <label>Course</label>
          <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setStudentId(""); setReport(null); }}>
            <option value="">Select a course…</option>
            {(courses.data?.content || []).map((c) => (
              <option key={c.courseId} value={c.courseId}>{c.title} ({c.status})</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 240, flex: 1 }}>
          <label>Student (for the progress deep-dive)</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!courseId}>
            <option value="">Select a student…</option>
            {(students.data?.content || []).map((s) => (
              <option key={s.studentId} value={s.studentId}>{s.name} · {s.email}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy || !courseId || !studentId} onClick={runReport}>
          {busy ? "Running…" : "Run student report"}
        </button>
      </div>

      {courseId && (
        <>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Course analytics</h2>
          {analytics.loading && <Spinner />}
          <ErrorNotice error={analytics.error} onRetry={analytics.reload} />
          {analytics.data && (
            <div className="course-grid" style={{ marginBottom: 28 }}>
              {[
                ["Enrolled (active)", analytics.data.totalEnrolled],
                ["Completed", analytics.data.completed],
                ["In progress", analytics.data.inProgress],
                ["Not started", analytics.data.notStarted],
                ["Avg quiz score", Number(analytics.data.averageQuizScore).toFixed(1) + "%"],
              ].map(([label, v]) => (
                <div className="card stat" key={label}><div className="num">{v}</div><div className="lbl">{label}</div></div>
              ))}
            </div>
          )}
        </>
      )}

      {report && (
        <>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>
            {report.studentName} — {report.courseProgressPercentage}% complete
          </h2>
          <div className="card" style={{ padding: 22, maxWidth: 720 }}>
            <div className="kv"><span>Email</span><b>{report.studentEmail}</b></div>
            <div className="kv"><span>Lessons</span>
              <b>{report.completedLessons}/{report.totalLessons}{report.courseCompleted ? " · course completed ✓" : ""}</b></div>
            <h4 style={{ margin: "16px 0 6px", fontSize: 15 }}>Video watch time (anti-cheat verified)</h4>
            {report.videoProgress.length === 0 && <EmptyState>No watch time recorded yet.</EmptyState>}
            {report.videoProgress.map((v) => (
              <div className="kv" key={v.lessonId}>
                <span>Lesson #{v.lessonId} (video #{v.videoId})</span>
                <b>{v.totalWatchedSeconds}s · {v.progressPercentage}%{v.completed ? " ✓" : ""}</b>
              </div>
            ))}
            <h4 style={{ margin: "16px 0 6px", fontSize: 15 }}>Quiz performance</h4>
            {report.quizProgress.length === 0 && <EmptyState>No quizzes in this course.</EmptyState>}
            {report.quizProgress.map((q) => (
              <div className="kv" key={q.quizId}>
                <span>{q.title}</span>
                <b>{q.attempts} attempt{q.attempts === 1 ? "" : "s"} · best {Number(q.bestScore).toFixed(0)}% · {q.passed ? "passed ✓" : "not passed"}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
