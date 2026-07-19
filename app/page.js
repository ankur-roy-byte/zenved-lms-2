import Link from "next/link";

/**
 * Public marketing page. Deliberately static: the backend's course
 * catalog requires an authenticated session, and its only public
 * API is certificate verification (linked below).
 */
const PROGRAMMES = [
  { icon: "⚡", title: "AI & Machine Learning Foundations", cat: "Technology",
    tagline: "Master real-world AI with hands-on projects and industry mentors.", type: "PAID" },
  { icon: "🚁", title: "UAV & Drone Manufacturing", cat: "Defence & Aerospace",
    tagline: "Build, fly, and certify your own drone with DGCA compliance training.", type: "PAID" },
  { icon: "💾", title: "Semiconductor & Chip Design Primer", cat: "Technology",
    tagline: "India's semiconductor future needs engineers trained today. Free starter track.", type: "FREE" },
  { icon: "🎯", title: "Missile & Systems Technology", cat: "Defence & Aerospace",
    tagline: "Systems design & integration certification with a DRDO pathway.", type: "PAID" },
];

export default function Landing() {
  return (
    <div className="container">
      <nav className="landing-nav">
        <div className="logo">Zen<span>Ved</span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/verify" className="btn btn-ghost">Verify certificate</Link>
          <Link href="/login" className="btn btn-primary">Sign in</Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <h1>Deep-tech skills for <em>India&rsquo;s next decade</em></h1>
          <p className="lead">
            Specialised programmes in AI, Drones, Semiconductors, and Defence —
            with mentor-led videos, per-lesson quizzes, and QR-verifiable certificates.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-primary">Explore your courses →</Link>
            <Link href="/verify" className="btn btn-ghost">Verify a certificate</Link>
          </div>
        </div>
        <div className="hero-panel">
          <div className="row"><span>Learning</span><b>Video + article + resource lessons</b></div>
          <div className="row"><span>Assessment</span><b>Per-lesson quizzes, strict scoring</b></div>
          <div className="row"><span>Progress</span><b>Verified watch-time tracking</b></div>
          <div className="row"><span>Credential</span><b>QR-verifiable PDF certificate</b></div>
          <div className="row"><span>Access</span><b>Google sign-in · invite or free enrol</b></div>
        </div>
      </section>

      <section id="courses" style={{ paddingBottom: 56 }}>
        <h2 style={{ fontSize: 28, marginBottom: 18 }}>Flagship programmes</h2>
        <div className="course-grid">
          {PROGRAMMES.map((c) => (
            <div className="card ticket" key={c.title}>
              <div className="body">
                <span className="chip chip-gray">{c.cat}</span>
                <h3>{c.icon} {c.title}</h3>
                <div className="tagline">{c.tagline}</div>
              </div>
              <div className="stub">
                <div className="tag">Access</div>
                <div className="price">{c.type === "FREE" ? "Free" : "Invite"}</div>
                <Link href="/login" className="btn btn-primary btn-sm">Enrol</Link>
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: 16 }}>
          Free programmes are open to any signed-in learner. Paid programmes are
          access-controlled — your enrollment is set up by our admissions team, then the
          course appears under <i>My learning</i> when you sign in with Google.
        </p>
      </section>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "24px 0 40px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, color: "var(--ink-soft)", fontSize: 14 }}>
        <span>© 2026 ZenVed Innovation Center</span>
        <span>
          <Link href="/verify" style={{ color: "var(--primary)" }}>Certificate verification</Link>
          {" · "}
          <Link href="/login" style={{ color: "var(--primary)" }}>Sign in</Link>
        </span>
      </footer>
    </div>
  );
}
