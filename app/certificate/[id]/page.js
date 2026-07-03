"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDB, currentUser, enrollment, certificateEligible } from "@/lib/store";

export default function CertificatePage() {
  const { id } = useParams();
  const [db, setDb] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => { setDb(getDB()); setMe(currentUser()); }, []);
  if (!db || !me) return null;

  const course = db.courses.find((c) => c.id === id);
  const enr = course && enrollment(db, me.id, course.id);
  const ok = course && certificateEligible(course, enr);

  if (!ok) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 520 }}>
          <div style={{ fontSize: 40 }}>🎓</div>
          <h2 style={{ fontSize: 24, margin: "10px 0" }}>Certificate not available yet</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
            Certificates are issued only after payment <b>and</b> 100% chapter
            completion of the course.
          </p>
          <Link href="/student" className="btn btn-primary">← Back to my learning</Link>
        </div>
      </div>
    );
  }

  const issued = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const certId = "ZV-" + course.id.toUpperCase().replace(/-/g, "") + "-" + me.id.slice(-3).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <Link href="/student" className="btn btn-ghost">← My learning</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
      </div>

      <div className="cert">
        <div className="seal">ZV</div>
        <div style={{ fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          ZenVed Innovation Center
        </div>
        <h1>Certificate of Completion</h1>
        <p style={{ color: "var(--ink-soft)" }}>This is to certify that</p>
        <div className="name">{me.name}</div>
        <p style={{ maxWidth: 520, margin: "0 auto", color: "var(--ink-mid)" }}>
          has successfully completed all {course.chapters.length} chapters of the programme
          <br />
          <b style={{ fontSize: 19 }}>{course.title}</b>
          <br />
          <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>
            {course.level} · {course.months} · Enrolled {enr.paidAt} · Issued {issued}
          </span>
        </p>
        <div className="sig-row">
          <div className="sig">Priya Nair<br />Programme Director</div>
          <div className="sig">Rahul Menon<br />Lead Instructor</div>
          <div className="sig">Certificate ID<br /><b>{certId}</b></div>
        </div>
      </div>
    </div>
  );
}
