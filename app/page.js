"use client";
import Link from "next/link";
import { seedDB, inr } from "@/lib/store";

const db = seedDB(); // static marketing view of the catalog

const TESTIMONIALS = [
  {
    quote:
      "The AI course didn't just teach me concepts — I built production-ready projects that I now show in every interview. Placed at a Bengaluru AI startup within 3 months.",
    initials: "PK", name: "Priya Krishnamurthy", role: "AI Engineer · Batch 2024",
  },
  {
    quote:
      "I was at a regular IT company before ZenVed. The UAV course completely changed my career trajectory — I'm now working on delivery drones.",
    initials: "RS", name: "Rohit Sharma", role: "Drone Engineer",
  },
  {
    quote:
      "The Semiconductor course is unlike anything available in Indian colleges. The EDA tool access alone is worth the fee — and the placement team actually cared.",
    initials: "AM", name: "Ananya Menon", role: "VLSI Design Engineer · Bengaluru",
  },
];

export default function Landing() {
  return (
    <>
      <div className="container">
        <nav className="landing-nav">
          <div className="logo">
            Zen<span>Ved</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/login" className="btn btn-primary">Apply now</Link>
          </div>
        </nav>

        <section className="hero">
          <div>
            <span className="chip chip-green">Now enrolling · Batch 2026</span>
            <h1 style={{ marginTop: 16 }}>
              Learn the skills that will build <em>Bharat&rsquo;s future</em>.
            </h1>
            <p className="lead">
              Specialised courses in AI, Drones, Semiconductors, and Defence —
              designed for engineers who want to do work that actually matters.
              Chapter-by-chapter progress tracking and a recognised certificate
              on completion.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/login" className="btn btn-primary">Explore courses</Link>
              <a href="#courses" className="btn btn-ghost">View catalog ↓</a>
            </div>
            <p style={{ marginTop: 22, fontSize: 13, color: "var(--ink-soft)", letterSpacing: ".04em" }}>
              TRUSTED BY ENGINEERS FROM &nbsp; IIT · NIT · BITS · VTU
            </p>
          </div>
          <div className="hero-panel">
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 10 }}>
              ZenVed by the numbers
            </div>
            <div className="row"><span>Students enrolled</span><b>1,250+</b></div>
            <div className="row"><span>Placement rate</span><b>92%</b></div>
            <div className="row"><span>Industry mentors</span><b>30+</b></div>
            <div className="row"><span>College partners</span><b>50+</b></div>
            <div className="row"><span>Student rating</span><b>4.8★</b></div>
          </div>
        </section>

        <section className="stats">
          <div className="card stat"><div className="num">6</div><div className="lbl">Specialised deep-tech programmes across AI, aerospace &amp; defence</div></div>
          <div className="card stat"><div className="num">31</div><div className="lbl">Video chapters with live projects and hands-on labs</div></div>
          <div className="card stat"><div className="num">100%</div><div className="lbl">Recognised certificate on completion of every paid course</div></div>
        </section>

        <section id="courses" style={{ paddingBottom: 56 }}>
          <h2 style={{ fontSize: 30, marginBottom: 6 }}>Find your path in deep-tech</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
            One-time payment. Full chapter access. Certificate included.
          </p>
          <div className="course-grid">
            {db.courses.map((c) => (
              <div className="card ticket" key={c.id}>
                <div className="body">
                  <span className="chip chip-gray">{c.icon} {c.category}</span>
                  <h3>{c.title}</h3>
                  <div className="tagline">{c.tagline}</div>
                  <div className="meta">
                    <span>▣ {c.chapters.length} chapters</span>
                    <span>◷ {c.months}</span>
                  </div>
                </div>
                <div className="stub">
                  <div className="tag">From</div>
                  <div className="price">{inr(c.price)}</div>
                  <Link href="/login" className="btn btn-primary btn-sm">Enrol</Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ paddingBottom: 72 }}>
          <h2 style={{ fontSize: 30, marginBottom: 6 }}>Real people, real outcomes</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
            Don&rsquo;t take our word for it — here&rsquo;s what students say about learning at ZenVed.
          </p>
          <div className="course-grid">
            {TESTIMONIALS.map((t) => (
              <div className="card" key={t.initials} style={{ padding: 22 }}>
                <div style={{ color: "var(--amber)", marginBottom: 10 }}>★★★★★</div>
                <p style={{ fontSize: 14.5, color: "var(--ink-mid)" }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 999, background: "var(--primary-soft)",
                    color: "var(--primary-deep)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
                  }}>{t.initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer style={{ background: "var(--ink)", color: "#9fb1ac", padding: "32px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "#fff" }}>
              Zen<span style={{ color: "var(--primary-bright)" }}>Ved</span>
            </div>
            <div style={{ fontSize: 13.5, maxWidth: 420, marginTop: 6 }}>
              India&rsquo;s deep-tech education &amp; innovation platform — where Vedic
              wisdom meets frontier engineering. Bengaluru &amp; Mysuru, Karnataka.
            </div>
          </div>
          <div style={{ fontSize: 13.5, textAlign: "right" }}>
            © 2026 ZenVed Innovation Center. All rights reserved.
            <br />
            Admin · Instructor · Student portals — <Link href="/login" style={{ color: "#fff" }}>Sign in</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
