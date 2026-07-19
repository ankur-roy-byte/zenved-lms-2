"use client";
import Link from "next/link";
import Shell from "@/components/Shell";
import { query } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice } from "@/components/ui";

/** Admin dashboard — ADMIN_DASHBOARD platform stats + quick links. */
export default function AdminDashboard() {
  const { data, error, loading, reload } = useAsync(() => query("ADMIN_DASHBOARD"), []);

  return (
    <Shell role="ADMIN">
      <h1 className="page-title">Admin dashboard</h1>
      <p className="page-sub">Platform overview — courses, people and credentials at a glance.</p>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          <div className="course-grid" style={{ marginBottom: 28 }}>
            {[
              ["Courses", data.totalCourses, "/admin/courses"],
              ["Published", data.publishedCourses, "/admin/courses"],
              ["Drafts", data.draftCourses, "/admin/courses"],
              ["Students", data.totalStudents, "/admin/users"],
              ["Active students", data.activeStudents, "/admin/users"],
              ["Instructors", data.totalInstructors, "/admin/users"],
              ["Certificates issued", data.certificatesIssued, "/admin/certificates"],
            ].map(([label, num, href]) => (
              <Link href={href} key={label} className="card stat" style={{ display: "block" }}>
                <div className="num">{num}</div>
                <div className="lbl">{label}</div>
              </Link>
            ))}
          </div>

          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Common tasks</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/enrollments" className="btn btn-primary btn-sm">Enroll a student</Link>
            <Link href="/admin/courses" className="btn btn-ghost btn-sm">Review &amp; publish courses</Link>
            <Link href="/admin/users" className="btn btn-ghost btn-sm">Create an instructor</Link>
            <Link href="/admin/reports" className="btn btn-ghost btn-sm">Run a progress report</Link>
            <Link href="/admin/audit" className="btn btn-ghost btn-sm">Inspect the audit log</Link>
          </div>
        </>
      )}
    </Shell>
  );
}
