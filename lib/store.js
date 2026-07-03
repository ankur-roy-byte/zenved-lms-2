// ─────────────────────────────────────────────────────────────
// ZenVed LMS — frontend-only data store.
// All data (users, courses, enrollments, uploads) lives in
// localStorage. No backend required. Deployable end-to-end.
// ─────────────────────────────────────────────────────────────

const DB_KEY = "zenved_db_v1";
const SESSION_KEY = "zenved_session_v1";

const V = (n) =>
  `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${n}.mp4`;

const SAMPLES = [
  "BigBuckBunny", "ElephantsDream", "ForBiggerBlazes", "ForBiggerEscapes",
  "ForBiggerFun", "ForBiggerJoyrides", "ForBiggerMeltdowns", "Sintel", "TearsOfSteel",
];

const ch = (id, title, mins, i) => ({
  id, title, duration: `${mins} min`, videoUrl: V(SAMPLES[i % SAMPLES.length]),
});

export function seedDB() {
  return {
    users: [
      { id: "u-admin", username: "admin", password: "admin123", name: "Priya Nair", role: "admin" },
      { id: "u-inst", username: "instructor", password: "instructor123", name: "Rahul Menon", role: "instructor" },
      { id: "u-abc", username: "abc", password: "abc", name: "Ananya Kulkarni", role: "student" },
      { id: "u-stu2", username: "student", password: "student123", name: "Vikram Rao", role: "student" },
    ],
    courses: [
      {
        id: "c-ai", icon: "⚡", title: "AI & Machine Learning",
        tagline: "Master real-world AI with hands-on projects and industry mentors.",
        category: "Technology", level: "Foundation → Advanced", months: "6 months",
        seats: "500 seats/yr", price: 25000, instructorId: "u-inst",
        chapters: [
          ch("c-ai-1", "Orientation & Python environment setup", 22, 0),
          ch("c-ai-2", "Machine learning foundations", 45, 1),
          ch("c-ai-3", "Deep learning & neural networks", 52, 2),
          ch("c-ai-4", "Live project: real-data portfolio build", 60, 3),
          ch("c-ai-5", "Model deployment & MLOps overview", 38, 4),
          ch("c-ai-6", "Capstone review & placement preparation", 30, 5),
        ],
      },
      {
        id: "c-uav", icon: "🚁", title: "UAV & Drone Manufacturing",
        tagline: "Build, fly, and certify your own drone with DGCA compliance training.",
        category: "Defence & Aerospace", level: "Intermediate → Expert", months: "4 months",
        seats: "200 seats/yr", price: 40000, instructorId: "u-inst",
        chapters: [
          ch("c-uav-1", "Orientation & the Indian UAV industry", 25, 6),
          ch("c-uav-2", "DGCA regulations & compliance training", 40, 7),
          ch("c-uav-3", "Airframe assembly lab walkthrough", 48, 8),
          ch("c-uav-4", "Flight operations & safety procedures", 36, 0),
          ch("c-uav-5", "Certification, startup kit & career pathways", 28, 1),
        ],
      },
      {
        id: "c-semi", icon: "💾", title: "Semiconductor & Chip Design",
        tagline: "India's semiconductor future needs engineers trained today.",
        category: "Technology", level: "Foundation → Fab-ready", months: "6 months",
        seats: "300 seats/yr", price: 40000, instructorId: "u-inst",
        chapters: [
          ch("c-semi-1", "The semiconductor industry landscape", 24, 2),
          ch("c-semi-2", "Digital design fundamentals", 44, 3),
          ch("c-semi-3", "VLSI design flow overview", 50, 4),
          ch("c-semi-4", "EDA tools orientation: Cadence & Synopsys", 46, 5),
          ch("c-semi-5", "Verification basics & tape-out concepts", 42, 6),
          ch("c-semi-6", "India Semiconductor Mission & placements", 26, 7),
        ],
      },
      {
        id: "c-missile", icon: "🎯", title: "Missile & Systems Technology",
        tagline: "Systems design & integration certification with a DRDO pathway.",
        category: "Defence & Aerospace", level: "Advanced (B.Tech+)", months: "6 months",
        seats: "100 seats/yr", price: 60000, instructorId: "u-inst",
        chapters: [
          ch("c-mis-1", "Aerospace & defence sector overview", 26, 8),
          ch("c-mis-2", "Systems engineering fundamentals", 42, 0),
          ch("c-mis-3", "Integration & testing concepts", 40, 1),
          ch("c-mis-4", "Security clearance & compliance preparation", 30, 2),
          ch("c-mis-5", "Career pathways in the DRDO ecosystem", 24, 3),
        ],
      },
      {
        id: "c-def", icon: "🛡️", title: "Arms & Defence Manufacturing",
        tagline: "DPIIT licensing, vendor registration and MoD pathway workshop.",
        category: "Defence & Aerospace", level: "Industry Track", months: "3 months",
        seats: "150 seats/yr", price: 50000, instructorId: "u-inst",
        chapters: [
          ch("c-def-1", "India's defence manufacturing landscape", 28, 4),
          ch("c-def-2", "DPIIT licensing & vendor registration", 38, 5),
          ch("c-def-3", "MSME integration & supply-chain access", 34, 6),
          ch("c-def-4", "Ministry of Defence pathway workshop", 32, 7),
        ],
      },
      {
        id: "c-inc", icon: "🚀", title: "Startup Incubator Programme",
        tagline: "Idea to MVP in 90 days — funding access, mentors, and a lab.",
        category: "Startup", level: "Open Track", months: "12 months",
        seats: "30 startups/yr", price: 100000, instructorId: "u-inst",
        chapters: [
          ch("c-inc-1", "Programme orientation & cohort kickoff", 20, 8),
          ch("c-inc-2", "Idea to MVP: the 90-day framework", 44, 0),
          ch("c-inc-3", "Funding & investor readiness", 40, 1),
          ch("c-inc-4", "IP, patents & legal basics", 36, 2),
          ch("c-inc-5", "Demo day & pitch preparation", 30, 3),
        ],
      },
    ],
    // paid = has purchased; completedChapters drives progress + certificate
    enrollments: [
      { studentId: "u-abc", courseId: "c-ai", paid: true, paidAt: "2026-05-14",
        completedChapters: ["c-ai-1", "c-ai-2", "c-ai-3", "c-ai-4"] },
      { studentId: "u-abc", courseId: "c-uav", paid: true, paidAt: "2026-02-10",
        completedChapters: ["c-uav-1", "c-uav-2", "c-uav-3", "c-uav-4", "c-uav-5"] },
      { studentId: "u-stu2", courseId: "c-semi", paid: true, paidAt: "2026-06-01",
        completedChapters: ["c-semi-1", "c-semi-2"] },
    ],
    uploads: [
      { id: "up-1", fileName: "ai-ch3-deep-learning.mp4", courseId: "c-ai",
        chapterId: "c-ai-3", uploadedBy: "Priya Nair", at: "2026-06-20", size: "412 MB" },
    ],
  };
}

export function getDB() {
  if (typeof window === "undefined") return seedDB();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = seedDB();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

export function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDB() {
  localStorage.removeItem(DB_KEY);
  return getDB();
}

// ── session ──
export function login(username, password) {
  const db = getDB();
  const user = db.users.find(
    (u) => u.username === username.trim() && u.password === password
  );
  if (!user) return null;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, role: user.role }));
  return user;
}

export function currentUser() {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s) return null;
    return getDB().users.find((u) => u.id === s.userId) || null;
  } catch { return null; }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

// ── derived helpers ──
export function enrollment(db, studentId, courseId) {
  return db.enrollments.find(
    (e) => e.studentId === studentId && e.courseId === courseId
  );
}

export function progressPct(course, enr) {
  if (!enr || !course.chapters.length) return 0;
  return Math.round((enr.completedChapters.length / course.chapters.length) * 100);
}

export function certificateEligible(course, enr) {
  return !!enr && enr.paid && progressPct(course, enr) === 100;
}

export function purchaseCourse(studentId, courseId) {
  const db = getDB();
  if (!enrollment(db, studentId, courseId)) {
    db.enrollments.push({
      studentId, courseId, paid: true,
      paidAt: new Date().toISOString().slice(0, 10),
      completedChapters: [],
    });
    saveDB(db);
  }
  return db;
}

export function toggleChapter(studentId, courseId, chapterId) {
  const db = getDB();
  const enr = enrollment(db, studentId, courseId);
  if (!enr || !enr.paid) return db;
  const i = enr.completedChapters.indexOf(chapterId);
  if (i >= 0) enr.completedChapters.splice(i, 1);
  else enr.completedChapters.push(chapterId);
  saveDB(db);
  return db;
}

export const inr = (n) => "₹" + n.toLocaleString("en-IN");
