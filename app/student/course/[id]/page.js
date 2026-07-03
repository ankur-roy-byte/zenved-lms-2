"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import {
  getDB, currentUser, enrollment, progressPct,
  certificateEligible, toggleChapter,
} from "@/lib/store";

export default function CoursePlayer() {
  const { id } = useParams();
  const router = useRouter();
  const [db, setDb] = useState(null);
  const [me, setMe] = useState(null);
  const [activeCh, setActiveCh] = useState(null);

  useEffect(() => { setDb(getDB()); setMe(currentUser()); }, []);
  if (!db || !me) return <Shell role="student"><span /></Shell>;

  const course = db.courses.find((c) => c.id === id);
  if (!course) return <Shell role="student"><p>Course not found.</p></Shell>;

  const enr = enrollment(db, me.id, course.id);
  if (!enr?.paid) {
    // Payment gate — unpaid students cannot open the player.
    return (
      <Shell role="student">
        <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 520, margin: "60px auto" }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <h2 style={{ fontSize: 24, margin: "10px 0" }}>This course is locked</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
            You haven&rsquo;t purchased <b>{course.title}</b> yet. Buy it from your
            dashboard to unlock all {course.chapters.length} chapters.
          </p>
          <Link href="/student" className="btn btn-primary">← Back to my learning</Link>
        </div>
      </Shell>
    );
  }

  const current = course.chapters.find((c) => c.id === activeCh) || course.chapters[0];
  const pct = progressPct(course, enr);
  const cert = certificateEligible(course, enr);
  const blobUrl = typeof window !== "undefined" && window.__videoBlobs?.[current?.id];

  const mark = (chId) => setDb({ ...toggleChapter(me.id, course.id, chId) });

  return (
    <Shell role="student">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <Link href="/student" style={{ fontSize: 13.5, color: "var(--primary)" }}>← My learning</Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{course.icon} {course.title}</h1>
          <span style={{ color: "var(--ink-soft)" }}>{course.level} · {course.months}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>
            {enr.completedChapters.length}/{course.chapters.length} chapters · {pct}%
          </div>
          <div className="bar" style={{ width: 220 }}><div style={{ width: pct + "%" }} /></div>
        </div>
      </div>

      {cert && (
        <div className="notice" style={{ background: "var(--primary-soft)", borderColor: "var(--primary-bright)", color: "var(--primary-deep)" }}>
          🎓 Course complete! Your certificate is ready —{" "}
          <Link href={`/certificate/${course.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
            view & download it here
          </Link>.
        </div>
      )}

      <div className="player-grid">
        <div>
          {current ? (
            <>
              <video key={(blobUrl || current.videoUrl) + current.id} className="player" controls src={blobUrl || current.videoUrl} />
              <div className="card" style={{ padding: 18, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b style={{ fontSize: 16 }}>{current.title}</b>
                  <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{current.duration}{blobUrl ? " · admin-uploaded video" : ""}</div>
                </div>
                <button
                  className={"btn btn-sm " + (enr.completedChapters.includes(current.id) ? "btn-ghost" : "btn-primary")}
                  onClick={() => mark(current.id)}
                >
                  {enr.completedChapters.includes(current.id) ? "✓ Learned — undo" : "Mark chapter as learned"}
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--ink-soft)" }}>No chapters yet — the instructor is preparing content.</p>
          )}
        </div>

        <div className="card spine">
          <div style={{ padding: "10px 16px 14px", fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Chapters
          </div>
          {course.chapters.map((ch, i) => {
            const done = enr.completedChapters.includes(ch.id);
            return (
              <div
                key={ch.id}
                className={"spine-item" + (done ? " done" : "") + (current?.id === ch.id ? " active" : "")}
                onClick={() => setActiveCh(ch.id)}
              >
                <div className="n">{done ? "✓" : i + 1}</div>
                <div>
                  <div className="t">{ch.title}</div>
                  <div className="d">{ch.duration}</div>
                </div>
                <span style={{ fontSize: 12 }}>{current?.id === ch.id ? "▶" : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
