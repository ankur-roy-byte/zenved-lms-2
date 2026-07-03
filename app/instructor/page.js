"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { getDB, saveDB, currentUser, progressPct, inr } from "@/lib/store";

export default function InstructorPage() {
  const [db, setDb] = useState(null);
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(null);
  const [chTitle, setChTitle] = useState("");

  useEffect(() => { setDb(getDB()); setMe(currentUser()); }, []);
  if (!db || !me) return <Shell role="instructor"><span /></Shell>;

  const mine = db.courses.filter((c) => c.instructorId === me.id);

  const addChapter = (courseId) => {
    if (!chTitle.trim()) return;
    const next = { ...db };
    const c = next.courses.find((x) => x.id === courseId);
    c.chapters = [
      ...c.chapters,
      {
        id: c.id + "-" + Date.now(), title: chTitle.trim(), duration: "30 min",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      },
    ];
    saveDB(next); setDb(next); setChTitle("");
  };

  const removeChapter = (courseId, chapterId) => {
    const next = { ...db };
    const c = next.courses.find((x) => x.id === courseId);
    c.chapters = c.chapters.filter((ch) => ch.id !== chapterId);
    next.enrollments.forEach((e) => {
      if (e.courseId === courseId)
        e.completedChapters = e.completedChapters.filter((id) => id !== chapterId);
    });
    saveDB(next); setDb(next);
  };

  return (
    <Shell role="instructor">
      <h1 className="page-title">Instructor panel</h1>
      <p className="page-sub">
        Welcome back, {me.name}. You teach {mine.length} programmes with{" "}
        {db.enrollments.filter((e) => mine.some((c) => c.id === e.courseId)).length} paid enrollments.
      </p>

      {mine.map((c) => {
        const enrolled = db.enrollments.filter((e) => e.courseId === c.id && e.paid);
        const isOpen = open === c.id;
        return (
          <div className="card" key={c.id} style={{ marginBottom: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span className="chip chip-gray">{c.icon} {c.category}</span>
                <h3 style={{ fontSize: 20, margin: "8px 0 2px" }}>{c.title}</h3>
                <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                  {c.chapters.length} chapters · {c.months} · {inr(c.price)} · {enrolled.length} paid students
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(isOpen ? null : c.id)}>
                {isOpen ? "Hide details ↑" : "Manage ↓"}
              </button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <input
                    style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 10 }}
                    placeholder="New chapter title…"
                    value={chTitle}
                    onChange={(e) => setChTitle(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => addChapter(c.id)}>+ Add chapter</button>
                </div>
                <table className="data" style={{ marginBottom: 18 }}>
                  <tbody>
                    {c.chapters.map((ch, i) => (
                      <tr key={ch.id}>
                        <td style={{ width: 36, color: "var(--ink-soft)" }}>{String(i + 1).padStart(2, "0")}</td>
                        <td><b>{ch.title}</b></td>
                        <td style={{ color: "var(--ink-soft)" }}>{ch.duration}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeChapter(c.id, ch.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                  Enrolled students
                </div>
                {enrolled.length === 0 && <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>No paid students yet.</p>}
                {enrolled.map((e, i) => {
                  const s = db.users.find((u) => u.id === e.studentId);
                  const pct = progressPct(c, e);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                      <span style={{ width: 160, fontSize: 14.5, fontWeight: 600 }}>{s?.name}</span>
                      <div className="bar" style={{ flex: 1 }}><div style={{ width: pct + "%" }} /></div>
                      <span style={{ fontSize: 13, fontWeight: 700, width: 46, textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </Shell>
  );
}
