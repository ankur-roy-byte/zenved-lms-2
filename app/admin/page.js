"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import { getDB, saveDB, resetDB, progressPct, certificateEligible, inr } from "@/lib/store";

function AdminInner() {
  const params = useSearchParams();
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "courses");
  const [upCourse, setUpCourse] = useState("");
  const [upChapter, setUpChapter] = useState("");
  const [upFile, setUpFile] = useState(null);
  const [newCourse, setNewCourse] = useState({ title: "", price: "" });
  const [newChapter, setNewChapter] = useState({ courseId: "", title: "" });

  useEffect(() => { setDb(getDB()); }, []);
  useEffect(() => { const t = params.get("tab"); if (t) setTab(t); }, [params]);
  if (!db) return null;

  const students = db.users.filter((u) => u.role === "student");
  const revenue = db.enrollments
    .filter((e) => e.paid)
    .reduce((a, e) => a + (db.courses.find((c) => c.id === e.courseId)?.price || 0), 0);

  const doUpload = () => {
    if (!upFile || !upCourse) return alert("Choose a course and a video file first.");
    const url = URL.createObjectURL(upFile);
    if (typeof window !== "undefined") {
      window.__videoBlobs = window.__videoBlobs || {};
      if (upChapter) window.__videoBlobs[upChapter] = url;
    }
    const next = { ...db };
    next.uploads = [
      {
        id: "up-" + Date.now(), fileName: upFile.name, courseId: upCourse,
        chapterId: upChapter || null, uploadedBy: "Admin",
        at: new Date().toISOString().slice(0, 10),
        size: (upFile.size / (1024 * 1024)).toFixed(1) + " MB",
      },
      ...next.uploads,
    ];
    saveDB(next); setDb(next); setUpFile(null);
    alert("Video uploaded. (Frontend-only build: the file plays for this browser session; its record is saved.)");
  };

  const addCourse = () => {
    if (!newCourse.title || !newCourse.price) return;
    const next = { ...db };
    next.courses = [
      ...next.courses,
      {
        id: "c-" + Date.now(), icon: "📘", title: newCourse.title,
        tagline: "Newly added programme.", category: "Technology",
        level: "Open Track", months: "3 months", seats: "100 seats/yr",
        price: Number(newCourse.price), instructorId: "u-inst", chapters: [],
      },
    ];
    saveDB(next); setDb(next); setNewCourse({ title: "", price: "" });
  };

  const addChapter = () => {
    if (!newChapter.courseId || !newChapter.title) return;
    const next = { ...db };
    const c = next.courses.find((x) => x.id === newChapter.courseId);
    c.chapters = [
      ...c.chapters,
      {
        id: c.id + "-" + (c.chapters.length + 1) + "-" + Date.now(),
        title: newChapter.title, duration: "30 min",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      },
    ];
    saveDB(next); setDb(next); setNewChapter({ courseId: "", title: "" });
  };

  const removeCourse = (id) => {
    if (!confirm("Remove this course? Enrollments for it will also be removed.")) return;
    const next = { ...db };
    next.courses = next.courses.filter((c) => c.id !== id);
    next.enrollments = next.enrollments.filter((e) => e.courseId !== id);
    saveDB(next); setDb(next);
  };

  return (
    <Shell role="admin">
      <h1 className="page-title">Admin panel</h1>
      <p className="page-sub">Manage courses, upload videos, and track every student&rsquo;s chapter progress.</p>

      <div className="course-grid" style={{ marginBottom: 28 }}>
        <div className="card stat"><div className="num">{db.courses.length}</div><div className="lbl">Live courses</div></div>
        <div className="card stat"><div className="num">{students.length}</div><div className="lbl">Registered students</div></div>
        <div className="card stat"><div className="num">{db.enrollments.filter((e) => e.paid).length}</div><div className="lbl">Paid enrollments</div></div>
        <div className="card stat"><div className="num">{inr(revenue)}</div><div className="lbl">Total course revenue</div></div>
      </div>

      <div className="tabs">
        {[["courses", "Courses & chapters"], ["videos", "Video library"], ["students", "Student progress"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setDb(resetDB())}>Reset demo data</button>
      </div>

      {tab === "courses" && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 160px auto", gap: 12, alignItems: "end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>New course title</label>
              <input value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} placeholder="e.g. Robotics & Automation" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Fee (₹)</label>
              <input type="number" value={newCourse.price} onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })} placeholder="30000" />
            </div>
            <button className="btn btn-primary" onClick={addCourse}>+ Add course</button>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "220px 1fr auto", gap: 12, alignItems: "end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Course</label>
              <select value={newChapter.courseId} onChange={(e) => setNewChapter({ ...newChapter, courseId: e.target.value })}>
                <option value="">Select…</option>
                {db.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>New chapter title</label>
              <input value={newChapter.title} onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })} placeholder="e.g. Module 7: Career workshop" />
            </div>
            <button className="btn btn-ghost" onClick={addChapter}>+ Add chapter</button>
          </div>

          <div className="card">
            <table className="data">
              <thead><tr><th>Course</th><th>Category</th><th>Chapters</th><th>Fee</th><th /></tr></thead>
              <tbody>
                {db.courses.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.icon} {c.title}</b><br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{c.level} · {c.months}</span></td>
                    <td>{c.category}</td>
                    <td>{c.chapters.length}</td>
                    <td>{inr(c.price)}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => removeCourse(c.id)} style={{ color: "var(--danger)" }}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "videos" && (
        <>
          <div className="notice">
            Frontend-only build: uploaded video files play for the current browser
            session and their records are saved locally. Hook up storage (e.g. S3)
            when you add a backend.
          </div>
          <div className="card" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "220px 220px 1fr auto", gap: 12, alignItems: "end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Course</label>
              <select value={upCourse} onChange={(e) => { setUpCourse(e.target.value); setUpChapter(""); }}>
                <option value="">Select…</option>
                {db.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Attach to chapter (optional)</label>
              <select value={upChapter} onChange={(e) => setUpChapter(e.target.value)}>
                <option value="">—</option>
                {(db.courses.find((c) => c.id === upCourse)?.chapters || []).map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.title}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Video file</label>
              <input type="file" accept="video/*" onChange={(e) => setUpFile(e.target.files?.[0] || null)} />
            </div>
            <button className="btn btn-primary" onClick={doUpload}>⬆ Upload</button>
          </div>

          <div className="card">
            <table className="data">
              <thead><tr><th>File</th><th>Course</th><th>Chapter</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
              <tbody>
                {db.uploads.map((u) => {
                  const c = db.courses.find((x) => x.id === u.courseId);
                  const ch = c?.chapters.find((x) => x.id === u.chapterId);
                  const blobUrl = typeof window !== "undefined" && window.__videoBlobs?.[u.chapterId];
                  const dl = blobUrl || ch?.videoUrl;
                  return (
                    <tr key={u.id}>
                      <td><b>{u.fileName}</b></td>
                      <td>{c?.title || "—"}</td>
                      <td>{ch?.title || "—"}</td>
                      <td>{u.size}</td>
                      <td>{u.at} · {u.uploadedBy}</td>
                      <td>{dl ? <a className="btn btn-ghost btn-sm" href={dl} download={u.fileName}>⬇ Download</a> : "—"}</td>
                    </tr>
                  );
                })}
                {db.uploads.length === 0 && <tr><td colSpan={6} style={{ color: "var(--ink-soft)" }}>No videos uploaded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "students" && (
        <div className="card">
          <table className="data">
            <thead><tr><th>Student</th><th>Course</th><th>Paid</th><th style={{ width: 260 }}>Chapters learned</th><th>Certificate</th></tr></thead>
            <tbody>
              {db.enrollments.map((e, i) => {
                const s = db.users.find((u) => u.id === e.studentId);
                const c = db.courses.find((x) => x.id === e.courseId);
                if (!s || !c) return null;
                const pct = progressPct(c, e);
                return (
                  <tr key={i}>
                    <td><b>{s.name}</b><br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>@{s.username}</span></td>
                    <td>{c.icon} {c.title}</td>
                    <td>{e.paid ? <span className="chip chip-green">Paid · {e.paidAt}</span> : <span className="chip chip-gray">Unpaid</span>}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="bar" style={{ flex: 1 }}><div style={{ width: pct + "%" }} /></div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{e.completedChapters.length}/{c.chapters.length}</span>
                      </div>
                    </td>
                    <td>{certificateEligible(c, e) ? <span className="chip chip-amber">Issued ✓</span> : <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{pct}% done</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminInner />
    </Suspense>
  );
}
