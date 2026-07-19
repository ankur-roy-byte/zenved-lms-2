"use client";
import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { query, command } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, EmptyState, StatusChip, Pager, Modal, toast } from "@/components/ui";
import { errorText } from "@/lib/errors";

/** Instructor home: courses I own or am assigned to, + create course. */
export default function InstructorPage() {
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, error, loading, reload } = useAsync(
    () => query("INSTRUCTOR_COURSES", { pagination: { page, size: 20 } }), [page]);

  return (
    <Shell role="INSTRUCTOR">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">My courses</h1>
          <p className="page-sub">Courses you own or co-teach. Publishing is done by an admin after review.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ New course</button>
      </div>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          {data.content.length === 0 && (
            <EmptyState>No courses yet — create your first course to start building content.</EmptyState>
          )}
          <div className="course-grid">
            {data.content.map((c) => (
              <div className="card" key={c.courseId} style={{ padding: 20 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StatusChip value={c.status} />
                  <StatusChip value={c.courseType} />
                </div>
                <h3 style={{ fontSize: 19, margin: "10px 0 4px" }}>{c.title}</h3>
                <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 14 }}>
                  {c.category || "General"}{c.level ? ` · ${c.level}` : ""} · owner: {c.instructorName}
                </div>
                <Link href={`/instructor/course/${c.courseId}`} className="btn btn-primary btn-sm">
                  Manage content →
                </Link>
              </div>
            ))}
          </div>
          <Pager pageData={data} onPage={setPage} />
        </>
      )}

      <CreateCourseModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); reload(); }} />
    </Shell>
  );
}

function CreateCourseModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", category: "", level: "BEGINNER",
    language: "English", passingPercentage: 70, courseType: "PAID" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    if (!form.title.trim()) return toast("A course title is required.", "error");
    setBusy(true);
    try {
      const r = await command("CREATE_COURSE", {
        title: form.title.trim(),
        description: form.description || null,
        category: form.category || null,
        level: form.level || null,
        language: form.language || null,
        passingPercentage: Number(form.passingPercentage) || 70,
        courseType: form.courseType,
      });
      toast(`Course created as DRAFT (#${r.courseId}).`);
      onCreated(r);
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Create a course" onClose={onClose}>
      <div className="field"><label>Title</label>
        <input value={form.title} onChange={set("title")} placeholder="e.g. Robotics & Automation" /></div>
      <div className="field"><label>Description</label>
        <input value={form.description} onChange={set("description")} placeholder="One-line summary shown in the catalog" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Category</label>
          <input value={form.category} onChange={set("category")} placeholder="Technology" /></div>
        <div className="field"><label>Language</label>
          <input value={form.language} onChange={set("language")} /></div>
        <div className="field"><label>Level</label>
          <select value={form.level} onChange={set("level")}>
            <option value="BEGINNER">BEGINNER</option>
            <option value="INTERMEDIATE">INTERMEDIATE</option>
            <option value="ADVANCED">ADVANCED</option>
          </select></div>
        <div className="field"><label>Access type</label>
          <select value={form.courseType} onChange={set("courseType")}>
            <option value="PAID">PAID (invite-only)</option>
            <option value="FREE">FREE (self-enrol)</option>
          </select></div>
        <div className="field"><label>Course pass mark (%)</label>
          <input type="number" min={0} max={100} value={form.passingPercentage} onChange={set("passingPercentage")} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={create}>
          {busy ? "Creating…" : "Create course"}
        </button>
      </div>
    </Modal>
  );
}
