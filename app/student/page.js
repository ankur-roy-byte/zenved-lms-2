"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import {
  getDB, currentUser, enrollment, progressPct,
  certificateEligible, purchaseCourse, inr,
} from "@/lib/store";

export default function StudentPage() {
  const [db, setDb] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => { setDb(getDB()); setMe(currentUser()); }, []);
  if (!db || !me) return <Shell role="student"><span /></Shell>;

  const paidCourses = db.courses.filter((c) => enrollment(db, me.id, c.id)?.paid);
  const lockedCourses = db.courses.filter((c) => !enrollment(db, me.id, c.id)?.paid);

  const buy = (c) => {
    if (
      confirm(
        `Simulated payment\n\n${c.title}\nCourse fee: ${inr(c.price)}\n\nProceed with payment? (No real money — this is a frontend demo checkout.)`
      )
    ) {
      setDb({ ...purchaseCourse(me.id, c.id) });
      alert("Payment successful! The course is now unlocked in “My courses”.");
    }
  };

  return (
    <Shell role="student">
      <h1 className="page-title">My learning</h1>
      <p className="page-sub">
        Namaste, {me.name.split(" ")[0]} — pick up where you left off, or unlock a new programme.
      </p>

      <h2 style={{ fontSize: 21, marginBottom: 14 }}>My courses ({paidCourses.length})</h2>
      {paidCourses.length === 0 && (
        <p style={{ color: "var(--ink-soft)", marginBottom: 18 }}>
          You haven&rsquo;t purchased any course yet — browse the catalog below.
        </p>
      )}
      <div className="course-grid" style={{ marginBottom: 40 }}>
        {paidCourses.map((c) => {
          const enr = enrollment(db, me.id, c.id);
          const pct = progressPct(c, enr);
          const cert = certificateEligible(c, enr);
          return (
            <div className="card" key={c.id} style={{ padding: 20 }}>
              <span className="chip chip-green">Paid · {enr.paidAt}</span>
              <h3 style={{ fontSize: 19, margin: "10px 0 4px" }}>{c.icon} {c.title}</h3>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 14 }}>
                {enr.completedChapters.length} of {c.chapters.length} chapters learned
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div className="bar" style={{ flex: 1 }}><div style={{ width: pct + "%" }} /></div>
                <b style={{ fontSize: 13.5 }}>{pct}%</b>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/student/course/${c.id}`} className="btn btn-primary btn-sm">
                  {pct === 0 ? "Start course" : pct === 100 ? "Review course" : "Continue →"}
                </Link>
                {cert && (
                  <Link href={`/certificate/${c.id}`} className="btn btn-amber btn-sm">
                    🎓 View certificate
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 21, marginBottom: 6 }}>Locked courses</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginBottom: 16 }}>
        Pay once to unlock all chapters. Certificate issued on 100% completion.
      </p>
      <div className="course-grid">
        {lockedCourses.map((c) => (
          <div className="card ticket locked" key={c.id}>
            <div className="body">
              <span className="chip chip-gray">🔒 {c.category}</span>
              <h3>{c.icon} {c.title}</h3>
              <div className="tagline">{c.tagline}</div>
              <div className="meta">
                <span>▣ {c.chapters.length} chapters</span>
                <span>◷ {c.months}</span>
              </div>
            </div>
            <div className="stub">
              <div className="tag">Fee</div>
              <div className="price">{inr(c.price)}</div>
              <button className="btn btn-primary btn-sm" onClick={() => buy(c)}>Buy</button>
            </div>
          </div>
        ))}
        {lockedCourses.length === 0 && (
          <p style={{ color: "var(--ink-soft)" }}>You own every course. Impressive!</p>
        )}
      </div>
    </Shell>
  );
}
