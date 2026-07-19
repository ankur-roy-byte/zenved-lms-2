"use client";
import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { query, command, certificateDownloadUrl } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, EmptyState, StatusChip, Pager, toast, fmtDate } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { IS_MOCK } from "@/lib/config";

export default function StudentPage() {
  const [tab, setTab] = useState("mine");
  return (
    <Shell role="STUDENT">
      <h1 className="page-title">My learning</h1>
      <p className="page-sub">Pick up where you left off, browse the catalog, or download your certificates.</p>
      <div className="tabs">
        {[["mine", "My courses"], ["catalog", "Course catalog"], ["certs", "My certificates"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "mine" && <MyCourses />}
      {tab === "catalog" && <Catalog />}
      {tab === "certs" && <MyCertificates />}
    </Shell>
  );
}

function MyCourses() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync(
    () => query("MY_COURSES", { pagination: { page, size: 20 } }), [page]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const rows = data?.content || [];

  return (
    <>
      {rows.length === 0 && (
        <EmptyState>
          No enrollments yet. Free courses can be joined from the catalog tab; paid
          programmes appear here once our admissions team enrolls you.
        </EmptyState>
      )}
      <div className="course-grid">
        {rows.map((c) => {
          const active = c.enrollmentStatus === "ACTIVE";
          const published = c.courseStatus === "PUBLISHED";
          return (
            <div className="card" key={c.courseId} style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusChip value={c.courseType} />
                <StatusChip value={c.enrollmentStatus} />
                {!published && <span className="chip chip-gray">{c.courseStatus.replace(/_/g, " ")}</span>}
              </div>
              <h3 style={{ fontSize: 19, margin: "10px 0 4px" }}>{c.title}</h3>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 14 }}>
                {c.category || "General"}{c.level ? ` · ${c.level}` : ""}
                {c.accessStartDate ? ` · since ${fmtDate(c.accessStartDate)}` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div className="bar" style={{ flex: 1 }}><div style={{ width: (c.progressPercentage || 0) + "%" }} /></div>
                <b style={{ fontSize: 13.5 }}>{c.progressPercentage || 0}%</b>
              </div>
              {active && published ? (
                <Link href={`/student/course/${c.courseId}`} className="btn btn-primary btn-sm">
                  {c.progressPercentage === 0 ? "Start course" : c.progressPercentage === 100 ? "Review course" : "Continue →"}
                </Link>
              ) : (
                <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                  {active ? "This course is not open right now." : "Enrollment inactive — contact the admin team."}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <Pager pageData={data} onPage={setPage} />
    </>
  );
}

function Catalog() {
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const { data, error, loading, reload } = useAsync(
    () => query("COURSE_CATALOG", { pagination: { page, size: 20 } }), [page]);
  const mine = useAsync(() => query("MY_COURSES", { pagination: { page: 0, size: 100 } }), []);
  const enrolledIds = new Set((mine.data?.content || []).map((c) => c.courseId));

  const enroll = async (c) => {
    setBusyId(c.courseId);
    try {
      await command("ENROLL_SELF", { courseId: c.courseId });
      toast(`Enrolled in “${c.title}” — it's now in My courses.`);
      reload();
      mine.reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const rows = data?.content || [];

  return (
    <>
      {rows.length === 0 && <EmptyState>No published courses in the catalog yet.</EmptyState>}
      <div className="course-grid">
        {rows.map((c) => (
          <div className="card ticket" key={c.courseId}>
            <div className="body">
              <span className="chip chip-gray">{c.category || "General"}</span>
              <h3>{c.title}</h3>
              <div className="tagline">{c.description}</div>
              <div className="meta">
                {c.level && <span>◈ {c.level}</span>}
                {c.language && <span>🗣 {c.language}</span>}
              </div>
            </div>
            <div className="stub">
              <div className="tag">Access</div>
              <div className="price">{c.courseType === "FREE" ? "Free" : "Invite"}</div>
              {enrolledIds.has(c.courseId) ? (
                <Link href={`/student/course/${c.courseId}`} className="btn btn-ghost btn-sm">Open</Link>
              ) : c.selfEnrollable ? (
                <button className="btn btn-primary btn-sm" disabled={busyId === c.courseId} onClick={() => enroll(c)}>
                  {busyId === c.courseId ? "…" : "Enrol"}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }} title="Paid courses are enrolled by the admissions team">
                  Invite only
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pager pageData={data} onPage={setPage} />
    </>
  );
}

function MyCertificates() {
  const { data, error, loading, reload } = useAsync(() => query("MY_CERTIFICATES"), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  const rows = data || [];

  return (
    <>
      {rows.length === 0 && (
        <EmptyState>
          No certificates yet — finish all lessons and pass every quiz in a course, then
          generate your certificate from the course page.
        </EmptyState>
      )}
      <div className="course-grid">
        {rows.map((c) => (
          <div className="card" key={c.certificateId} style={{ padding: 20 }}>
            <span className="chip chip-amber">🎓 Certificate</span>
            <h3 style={{ fontSize: 18, margin: "10px 0 4px" }}>{c.courseTitle}</h3>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 6 }}>
              Issued {fmtDate(c.issuedAt)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              Code: <code>{c.certificateCode}</code>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/certificate/${c.certificateCode}`} className="btn btn-primary btn-sm">View</Link>
              {!IS_MOCK && (
                <a className="btn btn-amber btn-sm" href={certificateDownloadUrl(c.downloadUrl)} target="_blank" rel="noreferrer">
                  ⬇ PDF
                </a>
              )}
              <Link href={`/verify/${c.certificateCode}`} className="btn btn-ghost btn-sm">Verify</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
