// ─────────────────────────────────────────────────────────────
// Demo seed data for MOCK mode only. Shaped 1:1 like the backend's
// entities/read models so every screen renders identically against
// the real API. Never bundled in a production (live) build.
// ─────────────────────────────────────────────────────────────

const V = (n) => `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${n}.mp4`;

const NOW = "2026-07-18T09:00:00Z";

export function seedDb() {
  return {
    seq: 500, // next id for anything created at runtime

    // Google-style login is mocked with tokens "mock:<email>:<name>".
    adminAllowlist: ["admin@lms.local"],

    users: [
      { id: 1, name: "Priya Nair", email: "admin@lms.local", phone: "+91 98450 00001",
        password: "Admin@12345", roles: ["ADMIN"], status: "ACTIVE",
        googleSub: "sub-admin-1", deletionRequestedAt: null, createdAt: "2026-05-01T08:00:00Z" },
      { id: 2, name: "Rahul Menon", email: "rahul@zenved.in", phone: "+91 98450 00002",
        password: "Teach@12345", roles: ["INSTRUCTOR"], status: "ACTIVE",
        googleSub: "sub-inst-2", deletionRequestedAt: null, createdAt: "2026-05-02T08:00:00Z" },
      { id: 3, name: "Meera Iyer", email: "meera@zenved.in", phone: "+91 98450 00003",
        password: "Teach@12345", roles: ["INSTRUCTOR"], status: "ACTIVE",
        googleSub: "sub-inst-3", deletionRequestedAt: null, createdAt: "2026-05-05T08:00:00Z" },
      { id: 4, name: "Ananya Kulkarni", email: "ananya@student.in", phone: null,
        password: null, roles: ["STUDENT"], status: "ACTIVE",
        googleSub: "sub-stu-4", deletionRequestedAt: null, createdAt: "2026-05-10T08:00:00Z" },
      { id: 5, name: "Vikram Rao", email: "vikram@student.in", phone: null,
        password: null, roles: ["STUDENT"], status: "ACTIVE",
        googleSub: "sub-stu-5", deletionRequestedAt: null, createdAt: "2026-05-12T08:00:00Z" },
      { id: 6, name: "Sara Fernandes", email: "sara@student.in", phone: null,
        password: null, roles: ["STUDENT"], status: "PENDING_APPROVAL",
        googleSub: null, deletionRequestedAt: null, createdAt: "2026-06-28T08:00:00Z" },
    ],

    courses: [
      { id: 1, title: "AI & Machine Learning Foundations",
        description: "Master real-world AI with hands-on projects and industry mentors.",
        category: "Technology", level: "BEGINNER", language: "English",
        courseType: "PAID", status: "PUBLISHED", passingPercentage: 70,
        instructorId: 2, deletedAt: null, createdAt: "2026-05-03T08:00:00Z" },
      { id: 2, title: "UAV & Drone Manufacturing",
        description: "Build, fly, and certify your own drone with DGCA compliance training.",
        category: "Defence & Aerospace", level: "INTERMEDIATE", language: "English",
        courseType: "PAID", status: "PUBLISHED", passingPercentage: 70,
        instructorId: 2, deletedAt: null, createdAt: "2026-05-04T08:00:00Z" },
      { id: 3, title: "Semiconductor & Chip Design Primer",
        description: "India's semiconductor future needs engineers trained today. Free starter track.",
        category: "Technology", level: "BEGINNER", language: "English",
        courseType: "FREE", status: "PUBLISHED", passingPercentage: 60,
        instructorId: 3, deletedAt: null, createdAt: "2026-05-06T08:00:00Z" },
      { id: 4, title: "Missile & Systems Technology",
        description: "Systems design & integration certification with a DRDO pathway.",
        category: "Defence & Aerospace", level: "ADVANCED", language: "English",
        courseType: "PAID", status: "DRAFT", passingPercentage: 70,
        instructorId: 2, deletedAt: null, createdAt: "2026-06-15T08:00:00Z" },
      { id: 5, title: "Arms & Defence Manufacturing",
        description: "DPIIT licensing, vendor registration and MoD pathway workshop.",
        category: "Defence & Aerospace", level: "INTERMEDIATE", language: "English",
        courseType: "PAID", status: "IN_REVIEW", passingPercentage: 70,
        instructorId: 3, deletedAt: null, createdAt: "2026-06-20T08:00:00Z" },
      { id: 6, title: "Startup Incubator Programme (2025 cohort)",
        description: "Idea to MVP in 90 days — funding access, mentors, and a lab.",
        category: "Startup", level: "BEGINNER", language: "English",
        courseType: "PAID", status: "ARCHIVED", passingPercentage: 70,
        instructorId: 2, deletedAt: null, createdAt: "2026-01-10T08:00:00Z" },
    ],

    // Admin-assigned co-instructors (course owner is implicit, never stored here).
    courseInstructors: [
      { courseId: 1, userId: 3 },
    ],

    modules: [
      { id: 11, courseId: 1, title: "Orientation", description: "Start here", displayOrder: 1 },
      { id: 12, courseId: 1, title: "Machine Learning Fundamentals", description: "Core concepts", displayOrder: 2 },
      { id: 21, courseId: 2, title: "The Indian UAV Industry", description: null, displayOrder: 1 },
      { id: 22, courseId: 2, title: "DGCA Compliance", description: null, displayOrder: 2 },
      { id: 31, courseId: 3, title: "Semiconductors 101", description: null, displayOrder: 1 },
      { id: 41, courseId: 4, title: "Systems Engineering", description: "Draft curriculum", displayOrder: 1 },
      { id: 51, courseId: 5, title: "Licensing & Registration", description: null, displayOrder: 1 },
    ],

    lessons: [
      // Course 1 — AI & ML (5 tracked lessons)
      { id: 101, moduleId: 11, title: "Welcome & how this course works", description: "Meet your mentors",
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 1001 },
      { id: 102, moduleId: 11, title: "Python environment setup", description: "Read before the first lab",
        displayOrder: 2, isMandatory: true, lessonType: "ARTICLE", videoId: null,
        contentText: "## Setting up Python\n\nInstall Python 3.12 from python.org, then create a virtual environment:\n\n    python -m venv .venv\n    .venv\\Scripts\\activate\n    pip install numpy pandas scikit-learn\n\nVerify with `python -c \"import sklearn; print(sklearn.__version__)\"`. If you see a version number, you are ready for Module 2." },
      { id: 103, moduleId: 12, title: "Supervised vs unsupervised learning", description: null,
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 1002 },
      { id: 104, moduleId: 12, title: "Model evaluation & overfitting", description: "Ends with the module quiz",
        displayOrder: 2, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 1003 },
      { id: 105, moduleId: 12, title: "Course workbook & datasets", description: "Downloadable resources",
        displayOrder: 3, isMandatory: true, lessonType: "RESOURCE", videoId: null,
        contentText: "Workbook: https://example.org/zenved/ai-ml-workbook.pdf\nDatasets: https://example.org/zenved/ai-ml-datasets.zip\n\nDownload both before starting the capstone. Mark this lesson as done once you have them." },

      // Course 2 — UAV (3 tracked lessons)
      { id: 201, moduleId: 21, title: "The Indian UAV landscape", description: null,
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 2001 },
      { id: 202, moduleId: 22, title: "DGCA regulations walkthrough", description: null,
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 2002 },
      { id: 203, moduleId: 22, title: "Compliance checklist", description: "Ends with the certification quiz",
        displayOrder: 2, isMandatory: true, lessonType: "ARTICLE", videoId: null,
        contentText: "Before any flight: check NPNT compliance, digital sky registration, UIN plate fixed, geofence loaded, battery logs current. Keep the checklist in your kit bag — the quiz below is based on it." },

      // Course 3 — Semiconductor (FREE, 2 tracked lessons)
      { id: 301, moduleId: 31, title: "How chips are made", description: null,
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 3001 },
      { id: 302, moduleId: 31, title: "India Semiconductor Mission overview", description: null,
        displayOrder: 2, isMandatory: true, lessonType: "ARTICLE", videoId: null,
        contentText: "The India Semiconductor Mission (ISM) drives fab and ATMP investment across the country. This primer summarises the incentive structure and the careers it opens. Mark as read when done." },

      // Course 4 — DRAFT (builder demo, no video attached yet)
      { id: 401, moduleId: 41, title: "Introduction to systems engineering", description: "Video pending upload",
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: null },

      // Course 5 — IN_REVIEW
      { id: 501, moduleId: 51, title: "DPIIT licensing basics", description: null,
        displayOrder: 1, isMandatory: true, lessonType: "VIDEO", contentText: null, videoId: 5001 },
    ],

    // Short sample videos so demo completion (>= 90% watch time) is quick.
    videos: [
      { id: 1001, courseId: 1, lessonId: 101, fileName: "welcome.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 15, status: "READY",
        s3Key: "courses/1/lessons/101/videos/1001.mp4", sourceUrl: V("ForBiggerBlazes") },
      { id: 1002, courseId: 1, lessonId: 103, fileName: "supervised-vs-unsupervised.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 15, status: "READY",
        s3Key: "courses/1/lessons/103/videos/1002.mp4", sourceUrl: V("ForBiggerEscapes") },
      { id: 1003, courseId: 1, lessonId: 104, fileName: "model-evaluation.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 60, status: "READY",
        s3Key: "courses/1/lessons/104/videos/1003.mp4", sourceUrl: V("ForBiggerFun") },
      { id: 2001, courseId: 2, lessonId: 201, fileName: "uav-landscape.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 15, status: "READY",
        s3Key: "courses/2/lessons/201/videos/2001.mp4", sourceUrl: V("ForBiggerJoyrides") },
      { id: 2002, courseId: 2, lessonId: 202, fileName: "dgca-regulations.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 15, status: "READY",
        s3Key: "courses/2/lessons/202/videos/2002.mp4", sourceUrl: V("ForBiggerMeltdowns") },
      { id: 3001, courseId: 3, lessonId: 301, fileName: "how-chips-are-made.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 15, status: "READY",
        s3Key: "courses/3/lessons/301/videos/3001.mp4", sourceUrl: V("ForBiggerBlazes") },
      { id: 5001, courseId: 5, lessonId: 501, fileName: "dpiit-licensing.mp4", contentType: "video/mp4",
        fileSizeBytes: 2299653, durationSeconds: 15, status: "READY",
        s3Key: "courses/5/lessons/501/videos/5001.mp4", sourceUrl: V("ForBiggerEscapes") },
    ],

    quizzes: [
      { id: 71, lessonId: 104, title: "ML fundamentals check", passingPercentage: 70, maxAttempts: 5,
        questions: [
          { id: 711, questionText: "Which of these is a supervised learning task?",
            questionType: "SINGLE_CORRECT", marks: 1, displayOrder: 1,
            options: [
              { id: 7111, optionText: "Image classification with labelled data", isCorrect: true },
              { id: 7112, optionText: "K-means clustering", isCorrect: false },
              { id: 7113, optionText: "Dimensionality reduction", isCorrect: false },
            ] },
          { id: 712, questionText: "Which of the following are regularization techniques? (select all that apply)",
            questionType: "MULTIPLE_CORRECT", marks: 2, displayOrder: 2,
            options: [
              { id: 7121, optionText: "L1 (Lasso)", isCorrect: true },
              { id: 7122, optionText: "L2 (Ridge)", isCorrect: true },
              { id: 7123, optionText: "Gradient descent", isCorrect: false },
              { id: 7124, optionText: "One-hot encoding", isCorrect: false },
            ] },
          { id: 713, questionText: "A model with 99% training accuracy but 60% test accuracy is most likely…",
            questionType: "SINGLE_CORRECT", marks: 1, displayOrder: 3,
            options: [
              { id: 7131, optionText: "Overfitting", isCorrect: true },
              { id: 7132, optionText: "Underfitting", isCorrect: false },
              { id: 7133, optionText: "Perfectly generalised", isCorrect: false },
            ] },
        ] },
      { id: 72, lessonId: 203, title: "DGCA certification quiz", passingPercentage: 70, maxAttempts: 3,
        questions: [
          { id: 721, questionText: "What does NPNT stand for in Indian drone regulation?",
            questionType: "SINGLE_CORRECT", marks: 1, displayOrder: 1,
            options: [
              { id: 7211, optionText: "No Permission, No Takeoff", isCorrect: true },
              { id: 7212, optionText: "New Pilot, New Training", isCorrect: false },
              { id: 7213, optionText: "National Permit for Night Travel", isCorrect: false },
            ] },
          { id: 722, questionText: "Which items belong on the pre-flight checklist? (select all that apply)",
            questionType: "MULTIPLE_CORRECT", marks: 2, displayOrder: 2,
            options: [
              { id: 7221, optionText: "Digital Sky registration", isCorrect: true },
              { id: 7222, optionText: "UIN plate fixed to the airframe", isCorrect: true },
              { id: 7223, optionText: "Painting the drone white", isCorrect: false },
            ] },
        ] },
    ],

    enrollments: [
      { id: 91, studentId: 4, courseId: 1, status: "ACTIVE",
        accessStartDate: "2026-05-14", accessEndDate: null,
        paymentMode: "OFFLINE", paymentReference: "INV-2026-014", notes: null,
        createdAt: "2026-05-14T10:00:00Z" },
      { id: 92, studentId: 4, courseId: 2, status: "ACTIVE",
        accessStartDate: "2026-06-01", accessEndDate: null,
        paymentMode: "OFFLINE", paymentReference: "INV-2026-031", notes: null,
        createdAt: "2026-06-01T10:00:00Z" },
      { id: 93, studentId: 5, courseId: 1, status: "ACTIVE",
        accessStartDate: "2026-06-05", accessEndDate: null,
        paymentMode: "ONLINE", paymentReference: "RZP-88231", notes: null,
        createdAt: "2026-06-05T10:00:00Z" },
      // Invited but the student has never signed in (account PENDING_APPROVAL).
      { id: 94, studentId: 6, courseId: 2, status: "ACTIVE",
        accessStartDate: "2026-06-28", accessEndDate: null,
        paymentMode: "OFFLINE", paymentReference: "INV-2026-042", notes: "Corporate batch",
        createdAt: "2026-06-28T10:00:00Z" },
    ],

    // Ananya finished course 1; Vikram is mid-way through it.
    videoProgress: [
      { studentId: 4, courseId: 1, lessonId: 101, videoId: 1001,
        lastWatchedSeconds: 15, totalWatchedSeconds: 15, progressPercentage: 100, completed: true },
      { studentId: 4, courseId: 1, lessonId: 103, videoId: 1002,
        lastWatchedSeconds: 15, totalWatchedSeconds: 15, progressPercentage: 100, completed: true },
      { studentId: 4, courseId: 1, lessonId: 104, videoId: 1003,
        lastWatchedSeconds: 60, totalWatchedSeconds: 60, progressPercentage: 100, completed: true },
      { studentId: 4, courseId: 2, lessonId: 201, videoId: 2001,
        lastWatchedSeconds: 15, totalWatchedSeconds: 15, progressPercentage: 100, completed: true },
      { studentId: 5, courseId: 1, lessonId: 101, videoId: 1001,
        lastWatchedSeconds: 15, totalWatchedSeconds: 15, progressPercentage: 100, completed: true },
      { studentId: 5, courseId: 1, lessonId: 104, videoId: 1003,
        lastWatchedSeconds: 24, totalWatchedSeconds: 24, progressPercentage: 40, completed: false },
    ],

    lessonCompletions: [
      { studentId: 4, courseId: 1, lessonId: 102, completedAt: "2026-05-16T10:00:00Z" },
      { studentId: 4, courseId: 1, lessonId: 105, completedAt: "2026-06-10T10:00:00Z" },
    ],

    courseProgress: [
      { studentId: 4, courseId: 1, totalLessons: 5, completedLessons: 5, progressPercentage: 100, completed: true },
      { studentId: 4, courseId: 2, totalLessons: 3, completedLessons: 1, progressPercentage: 33, completed: false },
      { studentId: 5, courseId: 1, totalLessons: 5, completedLessons: 1, progressPercentage: 20, completed: false },
    ],

    quizAttempts: [
      { id: 81, quizId: 71, studentId: 4, attemptNumber: 1, scorePercentage: 100.0, passed: true,
        correctAnswers: 3, totalQuestions: 3,
        snapshot: JSON.stringify({ quizId: 71, quizTitle: "ML fundamentals check", passingPercentage: 70, scorePercentage: 100 }),
        createdAt: "2026-06-12T10:00:00Z" },
      { id: 82, quizId: 71, studentId: 5, attemptNumber: 1, scorePercentage: 25.0, passed: false,
        correctAnswers: 1, totalQuestions: 3,
        snapshot: JSON.stringify({ quizId: 71, quizTitle: "ML fundamentals check", passingPercentage: 70, scorePercentage: 25 }),
        createdAt: "2026-06-15T10:00:00Z" },
    ],

    certificates: [
      { id: 61, studentId: 4, courseId: 1, certificateCode: "CERT-2026-000061",
        certificateUid: "1f3d9a2e-5b1c-4c8e-9f21-demo00000061",
        recipientName: "Ananya Kulkarni", courseTitleSnapshot: "AI & Machine Learning Foundations",
        issuedAt: "2026-06-20T12:00:00Z", issuedBy: null, revoked: false, revokedAt: null, version: 1 },
      { id: 62, studentId: 5, courseId: 6, certificateCode: "CERT-2025-000062",
        certificateUid: "9c7b1d4f-2a6e-4e0b-8d33-demo00000062",
        recipientName: "Vikram Rao", courseTitleSnapshot: "Startup Incubator Programme (2025 cohort)",
        issuedAt: "2025-12-15T12:00:00Z", issuedBy: 1, revoked: true, revokedAt: "2026-02-01T12:00:00Z", version: 2 },
    ],

    auditLogs: [
      { id: 1, actorId: 1, actorEmail: "admin@lms.local", action: "CREATE_INSTRUCTOR", entityType: "COMMAND",
        entityId: null, details: "email=ra***; (pii-minimized)", requestId: "seed-001", createdAt: "2026-05-02T08:00:00Z" },
      { id: 2, actorId: 1, actorEmail: "admin@lms.local", action: "PUBLISH_COURSE", entityType: "COMMAND",
        entityId: null, details: "payload={\"courseId\":1}", requestId: "seed-002", createdAt: "2026-05-13T08:00:00Z" },
      { id: 3, actorId: 1, actorEmail: "admin@lms.local", action: "ENROLL_STUDENT", entityType: "COMMAND",
        entityId: null, details: "courseId=1; studentEmail=an***; (pii-minimized)", requestId: "seed-003", createdAt: "2026-05-14T10:00:00Z" },
      { id: 4, actorId: 1, actorEmail: "admin@lms.local", action: "REVOKE_CERTIFICATE", entityType: "COMMAND",
        entityId: null, details: "payload={\"certificateCode\":\"CERT-2025-000062\"}; reason=cohort credential withdrawn", requestId: "seed-004", createdAt: "2026-02-01T12:00:00Z" },
      { id: 5, actorId: 1, actorEmail: "admin@lms.local", action: "ASSIGN_INSTRUCTORS", entityType: "COMMAND",
        entityId: null, details: "courseId=1; instructorCount=1; (pii-minimized)", requestId: "seed-005", createdAt: "2026-05-20T08:00:00Z" },
    ],

    // runtime session state
    accessTokens: {},   // token -> { userId, expiresAt }
    refreshTokens: {},  // token -> { userId, familyId, revoked, replacedBy }
    idempotency: {},    // key -> { command, result }

    seededAt: NOW,
  };
}
