// ─────────────────────────────────────────────────────────────
// In-browser mock of the LMS backend. Implements the SAME
// contract as the live API — same channels, names, payloads,
// response shapes, error codes and permission rules — against
// seeded demo data in localStorage. MOCK MODE ONLY; the live
// build never imports this module.
// ─────────────────────────────────────────────────────────────
import { ApiError } from "../errors";
import { seedDb } from "./data";

const DB_KEY = "lms_mock_db_v2";
const LATENCY_MS = 160;
const ACCESS_TTL_MS = 30 * 60 * 1000;
const COMPLETION_THRESHOLD = 90;
const MAX_DELTA_SECONDS = 60;

// ── db plumbing ─────────────────────────────────────────────
let memoryDb = null; // SSR safety — never used meaningfully server-side

function loadDb() {
  if (typeof window === "undefined") return memoryDb || (memoryDb = seedDb());
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = seedDb();
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

function saveDb(db) {
  if (typeof window === "undefined") { memoryDb = db; return; }
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetMockDb() {
  if (typeof window !== "undefined") window.localStorage.removeItem(DB_KEY);
  memoryDb = null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const nextId = (db) => ++db.seq;

// ── errors (same codes as the backend) ──────────────────────
const badRequest = (m) => new ApiError({ code: "VALIDATION_ERROR", message: m, status: 400 });
const unauthorized = (m) => new ApiError({ code: "UNAUTHORIZED", message: m, status: 401 });
const forbidden = (m) => new ApiError({ code: "FORBIDDEN", message: m, status: 403 });
const notFound = (m) => new ApiError({ code: "NOT_FOUND", message: m, status: 404 });
const conflict = (c, m) => new ApiError({ code: c, message: m, status: 409 });
const businessRule = (c, m) => new ApiError({ code: c, message: m, status: 422 });

// ── auth helpers ────────────────────────────────────────────
function issueTokens(db, user) {
  const familyId = "fam-" + nextId(db);
  const access = "mock-access-" + nextId(db) + "-" + Date.now();
  const refresh = "mock-refresh-" + nextId(db) + "-" + Date.now();
  db.accessTokens[access] = { userId: user.id, expiresAt: Date.now() + ACCESS_TTL_MS };
  db.refreshTokens[refresh] = { userId: user.id, familyId, revoked: false, replacedBy: null };
  return { accessToken: access, refreshToken: refresh, user: userDto(user) };
}

function userDto(u) {
  return { id: u.id, name: u.name, email: u.email, roles: [...u.roles].sort(), status: u.status };
}

function requirePrincipal(db, accessToken) {
  const entry = accessToken ? db.accessTokens[accessToken] : null;
  if (!entry) throw unauthorized("Missing or invalid access token");
  if (entry.expiresAt < Date.now()) {
    delete db.accessTokens[accessToken];
    throw unauthorized("Access token expired");
  }
  const user = db.users.find((u) => u.id === entry.userId);
  if (!user) throw unauthorized("User no longer exists");
  if (user.status === "DISABLED") throw forbidden("Account is disabled");
  if (user.status === "ANONYMIZED") throw unauthorized("Account no longer exists");
  return user;
}

const hasRole = (u, r) => u.roles.includes(r);
function requireRole(u, r) { if (!hasRole(u, r)) throw forbidden("This operation requires role " + r); }
function requireAnyRole(u, ...rs) { if (!rs.some((r) => hasRole(u, r))) throw forbidden("You do not have permission to run this operation"); }

// ── domain helpers (mirror backend services) ────────────────
const courseById = (db, id) => db.courses.find((c) => c.id === Number(id));

function requireCourse(db, id) {
  const c = courseById(db, id);
  if (!c || c.deletedAt) throw notFound("Course not found: " + id);
  return c;
}

function canManageCourse(db, user, course) {
  if (hasRole(user, "ADMIN")) return true;
  if (!hasRole(user, "INSTRUCTOR")) return false;
  if (course.instructorId === user.id) return true;
  return db.courseInstructors.some((ci) => ci.courseId === course.id && ci.userId === user.id);
}

function requireOwnedCourse(db, user, courseId) {
  const course = requireCourse(db, courseId);
  if (!canManageCourse(db, user, course)) {
    throw forbidden("You can only manage courses you own or are assigned to");
  }
  return course;
}

function requireActiveEnrollment(db, studentId, courseId) {
  const e = db.enrollments.find((x) => x.studentId === studentId && x.courseId === Number(courseId));
  if (!e) throw forbidden("You are not enrolled in this course");
  if (e.status !== "ACTIVE") throw forbidden("Your enrollment is not active");
  const today = new Date().toISOString().slice(0, 10);
  if (e.accessStartDate && today < e.accessStartDate) throw forbidden("Your enrollment is not active yet");
  if (e.accessEndDate && today > e.accessEndDate) throw forbidden("Your enrollment has expired");
  return e;
}

const modulesOf = (db, courseId) =>
  db.modules.filter((m) => m.courseId === Number(courseId)).sort((a, b) => a.displayOrder - b.displayOrder);

const lessonsOfModule = (db, moduleId) =>
  db.lessons.filter((l) => l.moduleId === moduleId).sort((a, b) => a.displayOrder - b.displayOrder);

function lessonsOfCourse(db, courseId) {
  const modIds = new Set(modulesOf(db, courseId).map((m) => m.id));
  return db.lessons.filter((l) => modIds.has(l.moduleId));
}

function requireLesson(db, lessonId) {
  const l = db.lessons.find((x) => x.id === Number(lessonId));
  if (!l) throw notFound("Lesson not found: " + lessonId);
  return l;
}

function lessonCourse(db, lesson) {
  const mod = db.modules.find((m) => m.id === lesson.moduleId);
  return courseById(db, mod.courseId);
}

const videoById = (db, id) => db.videos.find((v) => v.id === Number(id));
const quizByLesson = (db, lessonId) => db.quizzes.find((q) => q.lessonId === Number(lessonId));
const quizzesOfCourse = (db, courseId) => {
  const lessonIds = new Set(lessonsOfCourse(db, courseId).map((l) => l.id));
  return db.quizzes.filter((q) => lessonIds.has(q.lessonId));
};

const trackedLessons = (db, courseId) =>
  lessonsOfCourse(db, courseId).filter((l) => l.videoId != null || l.lessonType !== "VIDEO");

function recomputeCourseProgress(db, studentId, courseId) {
  const tracked = trackedLessons(db, courseId);
  if (tracked.length === 0) return 0;
  const vps = db.videoProgress.filter((v) => v.studentId === studentId && v.courseId === Number(courseId));
  const read = new Set(db.lessonCompletions
    .filter((lc) => lc.studentId === studentId && lc.courseId === Number(courseId))
    .map((lc) => lc.lessonId));
  const done = tracked.filter((l) => l.lessonType === "VIDEO"
    ? vps.some((vp) => vp.lessonId === l.id && vp.completed)
    : read.has(l.id)).length;

  let cp = db.courseProgress.find((c) => c.studentId === studentId && c.courseId === Number(courseId));
  if (!cp) {
    cp = { studentId, courseId: Number(courseId), totalLessons: 0, completedLessons: 0, progressPercentage: 0, completed: false };
    db.courseProgress.push(cp);
  }
  cp.totalLessons = tracked.length;
  cp.completedLessons = done;
  cp.progressPercentage = Math.floor((done * 100) / tracked.length);
  cp.completed = done === tracked.length;
  return cp.progressPercentage;
}

function allMandatoryCompleted(db, studentId, courseId) {
  const mandatory = trackedLessons(db, courseId).filter((l) => l.isMandatory);
  if (mandatory.length === 0) return false;
  const vps = db.videoProgress.filter((v) => v.studentId === studentId && v.courseId === Number(courseId));
  const read = new Set(db.lessonCompletions
    .filter((lc) => lc.studentId === studentId && lc.courseId === Number(courseId))
    .map((lc) => lc.lessonId));
  return mandatory.every((l) => l.lessonType === "VIDEO"
    ? vps.some((vp) => vp.lessonId === l.id && vp.completed)
    : read.has(l.id));
}

function hasPassedAllQuizzes(db, studentId, courseId) {
  return quizzesOfCourse(db, courseId)
    .every((q) => db.quizAttempts.some((a) => a.quizId === q.id && a.studentId === studentId && a.passed));
}

function maskEmail(email) {
  if (!email) return "***";
  const local = email.split("@")[0];
  return local.slice(0, Math.min(2, local.length)) + "***";
}

function audit(db, actor, action, details) {
  db.auditLogs.unshift({
    id: nextId(db), actorId: actor.id, actorEmail: actor.email, action,
    entityType: "COMMAND", entityId: null, details,
    requestId: "mock-" + Math.random().toString(36).slice(2, 8), createdAt: nowIso(),
  });
}

function pageOf(items, pagination, sortSpec, sortableFields = {}) {
  let list = [...items];
  if (sortSpec?.field && sortableFields[sortSpec.field]) {
    const get = sortableFields[sortSpec.field];
    const dir = String(sortSpec.direction || "DESC").toUpperCase() === "ASC" ? 1 : -1;
    list.sort((a, b) => (get(a) > get(b) ? dir : get(a) < get(b) ? -dir : 0));
  }
  const page = Math.max(0, pagination?.page ?? 0);
  const size = Math.min(100, Math.max(1, pagination?.size ?? 20));
  const start = page * size;
  return {
    content: list.slice(start, start + size),
    page, size,
    totalElements: list.length,
    totalPages: Math.max(1, Math.ceil(list.length / size)),
  };
}

const f = (filters, key) => {
  const v = filters?.[key];
  return v === undefined || v === null || v === "" ? null : v;
};

// ── courseSummary / read models (field-exact with QueryService) ──
function courseSummary(db, c) {
  const instructor = db.users.find((u) => u.id === c.instructorId);
  return {
    courseId: c.id, title: c.title, description: c.description, category: c.category,
    level: c.level, language: c.language, courseType: c.courseType, status: c.status,
    passingPercentage: c.passingPercentage,
    instructorId: c.instructorId, instructorName: instructor?.name || "—",
    createdAt: c.createdAt,
  };
}

// ═════════════════════════════════ SESSION ═════════════════
function handleSession(db, { action, payload }, ctx) {
  switch (action) {
    case "LOGIN_PASSWORD": {
      const { email, password } = payload || {};
      if (!email || !password) throw badRequest("email and password are required");
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user || !user.password || user.password !== password) {
        throw unauthorized("Invalid email or password");
      }
      if (user.status === "DISABLED") throw forbidden("Account is disabled");
      return issueTokens(db, user);
    }
    case "LOGIN_GOOGLE": {
      // Mock Google ID tokens use the backend local-profile format: "mock:<email>:<name>"
      const idToken = payload?.idToken || "";
      if (!idToken.startsWith("mock:")) {
        throw unauthorized("Invalid Google ID token (mock mode expects mock:<email>:<name>)");
      }
      const [, email, name] = idToken.split(":");
      if (!email) throw badRequest("Malformed mock Google token");
      let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const allowlisted = db.adminAllowlist.some((a) => a.toLowerCase() === email.toLowerCase());

      if (!user) {
        if (!allowlisted) {
          throw unauthorized("No enrollment or account found for this Google account. Ask an admin to enroll you first.");
        }
        user = { id: nextId(db), name: name || email, email, phone: null, password: null,
          roles: ["ADMIN"], status: "ACTIVE", googleSub: "sub-" + email, deletionRequestedAt: null, createdAt: nowIso() };
        db.users.push(user);
      } else {
        if (user.status === "DISABLED") throw forbidden("Account is disabled");
        if (user.status === "PENDING_APPROVAL") user.status = "ACTIVE"; // invite activated on first login
        if (!user.googleSub) user.googleSub = "sub-" + email;
        if (allowlisted && !user.roles.includes("ADMIN")) user.roles.push("ADMIN");
      }
      return issueTokens(db, user);
    }
    case "REFRESH_TOKEN": {
      const token = payload?.refreshToken;
      const entry = token ? db.refreshTokens[token] : null;
      if (!entry) throw unauthorized("Invalid refresh token");
      if (entry.revoked || entry.replacedBy) {
        // Reuse detection — revoke the whole family (mirrors the backend).
        for (const [t, e] of Object.entries(db.refreshTokens)) {
          if (e.familyId === entry.familyId) db.refreshTokens[t] = { ...e, revoked: true };
        }
        throw unauthorized("Refresh token reuse detected — session revoked");
      }
      const user = db.users.find((u) => u.id === entry.userId);
      if (!user) throw unauthorized("User no longer exists");
      const fresh = issueTokens(db, user);
      db.refreshTokens[fresh.refreshToken].familyId = entry.familyId;
      entry.replacedBy = fresh.refreshToken;
      return fresh;
    }
    case "LOGOUT": {
      const token = payload?.refreshToken;
      if (token && db.refreshTokens[token]) db.refreshTokens[token].revoked = true;
      return null;
    }
    case "ME": {
      const user = requirePrincipal(db, ctx.accessToken);
      return { user: userDto(user), permissions: [...user.roles].sort() };
    }
    default:
      throw badRequest("Unsupported auth action: " + action);
  }
}

// ═════════════════════════════════ QUERIES ═════════════════
function handleQuery(db, { query, filters, pagination, sort }, ctx) {
  const user = requirePrincipal(db, ctx.accessToken);

  switch (query) {
    case "MY_COURSES": {
      requireRole(user, "STUDENT");
      let mine = db.enrollments.filter((e) => e.studentId === user.id);
      const status = f(filters, "status");
      if (status) mine = mine.filter((e) => e.status === String(status).toUpperCase());
      return pageOf(mine.map((e) => {
        const c = courseById(db, e.courseId);
        const cp = db.courseProgress.find((p) => p.studentId === user.id && p.courseId === e.courseId);
        return {
          courseId: c.id, title: c.title, description: c.description, category: c.category,
          level: c.level, courseType: c.courseType, courseStatus: c.status,
          enrollmentStatus: e.status, accessStartDate: e.accessStartDate, accessEndDate: e.accessEndDate,
          progressPercentage: cp?.progressPercentage ?? 0,
        };
      }), pagination, sort, { id: (x) => x.courseId, title: (x) => x.title });
    }

    case "COURSE_DETAIL": {
      const courseId = f(filters, "courseId");
      if (courseId == null) throw badRequest("filters.courseId is required");
      const course = requireCourse(db, courseId);
      const studentView = assertCourseReadAccess(db, user, course);
      const vps = studentView
        ? db.videoProgress.filter((v) => v.studentId === user.id && v.courseId === course.id)
        : [];
      const read = studentView
        ? new Set(db.lessonCompletions.filter((lc) => lc.studentId === user.id && lc.courseId === course.id).map((lc) => lc.lessonId))
        : new Set();
      const cp = studentView
        ? db.courseProgress.find((p) => p.studentId === user.id && p.courseId === course.id)
        : null;

      let trackedNow = 0;
      const modules = modulesOf(db, course.id).map((m) => ({
        moduleId: m.id, title: m.title, description: m.description, displayOrder: m.displayOrder,
        lessons: lessonsOfModule(db, m.id).map((l) => {
          const video = l.videoId ? videoById(db, l.videoId) : null;
          if (video || l.lessonType !== "VIDEO") trackedNow++;
          const vp = vps.find((v) => v.lessonId === l.id);
          const completed = l.lessonType === "VIDEO" ? !!vp?.completed : read.has(l.id);
          return {
            lessonId: l.id, title: l.title, description: l.description, displayOrder: l.displayOrder,
            isMandatory: l.isMandatory, lessonType: l.lessonType,
            videoId: video?.id ?? null, durationSeconds: video?.durationSeconds ?? null,
            videoStatus: video?.status ?? null,
            hasQuiz: !!quizByLesson(db, l.id),
            completed: studentView ? completed : false,
            lastWatchedSeconds: vp?.lastWatchedSeconds ?? 0,
          };
        }),
      }));

      return {
        courseId: course.id, title: course.title, description: course.description,
        category: course.category, level: course.level, language: course.language,
        courseType: course.courseType, status: course.status,
        passingPercentage: course.passingPercentage,
        progressPercentage: cp?.progressPercentage ?? 0,
        contentUpdatedSinceCompletion: !!(cp?.completed && trackedNow > cp.totalLessons),
        modules,
      };
    }

    case "LESSON_DETAIL": {
      const lessonId = f(filters, "lessonId");
      if (lessonId == null) throw badRequest("filters.lessonId is required");
      const lesson = requireLesson(db, lessonId);
      const course = lessonCourse(db, lesson);
      const studentView = assertCourseReadAccess(db, user, course);
      const video = lesson.videoId ? videoById(db, lesson.videoId) : null;
      const quiz = quizByLesson(db, lesson.id);
      const vp = studentView && video
        ? db.videoProgress.find((v) => v.studentId === user.id && v.videoId === video.id)
        : null;
      return {
        lessonId: lesson.id, title: lesson.title, description: lesson.description,
        isMandatory: lesson.isMandatory, lessonType: lesson.lessonType, contentText: lesson.contentText,
        moduleId: lesson.moduleId, courseId: course.id,
        video: video ? { videoId: video.id, fileName: video.fileName, durationSeconds: video.durationSeconds, status: video.status } : null,
        quiz: quiz ? { quizId: quiz.id, title: quiz.title, passingPercentage: quiz.passingPercentage, maxAttempts: quiz.maxAttempts, questionCount: quiz.questions.length } : null,
        progress: vp ? { lastWatchedSeconds: vp.lastWatchedSeconds, totalWatchedSeconds: vp.totalWatchedSeconds, progressPercentage: vp.progressPercentage, completed: vp.completed } : null,
      };
    }

    case "QUIZ_DETAIL": {
      const quizId = f(filters, "quizId");
      if (quizId == null) throw badRequest("filters.quizId is required");
      const quiz = db.quizzes.find((q) => q.id === Number(quizId));
      if (!quiz) throw notFound("Quiz not found: " + quizId);
      const course = lessonCourse(db, requireLesson(db, quiz.lessonId));
      const studentView = assertCourseReadAccess(db, user, course);
      return {
        quizId: quiz.id, lessonId: quiz.lessonId, title: quiz.title,
        passingPercentage: quiz.passingPercentage, maxAttempts: quiz.maxAttempts,
        questions: quiz.questions.map((q) => ({
          questionId: q.id, questionText: q.questionText, questionType: q.questionType, marks: q.marks,
          options: q.options.map((o) => studentView
            ? { optionId: o.id, optionText: o.optionText }
            : { optionId: o.id, optionText: o.optionText, isCorrect: o.isCorrect }),
        })),
        myAttempts: studentView
          ? db.quizAttempts
              .filter((a) => a.quizId === quiz.id && a.studentId === user.id)
              .sort((a, b) => b.attemptNumber - a.attemptNumber)
              .map((a) => ({ attemptId: a.id, attemptNumber: a.attemptNumber, scorePercentage: a.scorePercentage, passed: a.passed }))
          : [],
      };
    }

    case "MY_CERTIFICATES": {
      requireRole(user, "STUDENT");
      return db.certificates.filter((c) => c.studentId === user.id).map((c) => ({
        certificateId: c.id, certificateCode: c.certificateCode,
        courseId: c.courseId,
        courseTitle: courseById(db, c.courseId)?.title || c.courseTitleSnapshot,
        issuedAt: c.issuedAt,
        downloadUrl: "/api/v1/certificates/download/" + c.certificateCode,
      }));
    }

    case "COURSE_CATALOG": {
      let list = db.courses.filter((c) => c.status === "PUBLISHED" && !c.deletedAt);
      const type = f(filters, "courseType");
      if (type) list = list.filter((c) => c.courseType === String(type).toUpperCase());
      return pageOf(list.map((c) => ({
        courseId: c.id, title: c.title, description: c.description, category: c.category,
        level: c.level, language: c.language, courseType: c.courseType,
        selfEnrollable: c.courseType === "FREE",
      })), pagination, sort, { id: (x) => x.courseId, title: (x) => x.title });
    }

    case "INSTRUCTOR_COURSES": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const status = f(filters, "status");
      let list = db.courses.filter((c) => !c.deletedAt && canManageCourse(db, user, c));
      if (!hasRole(user, "ADMIN")) {
        list = list.filter((c) => c.instructorId === user.id ||
          db.courseInstructors.some((ci) => ci.courseId === c.id && ci.userId === user.id));
      }
      if (status) list = list.filter((c) => c.status === String(status).toUpperCase());
      return pageOf(list.map((c) => courseSummary(db, c)), pagination, sort,
        { id: (x) => x.courseId, title: (x) => x.title, status: (x) => x.status });
    }

    case "COURSE_STUDENTS": {
      const courseId = f(filters, "courseId");
      if (courseId == null) throw badRequest("filters.courseId is required");
      requireCourseOwnershipOrAdmin(db, user, courseId);
      const list = db.enrollments.filter((e) => e.courseId === Number(courseId));
      return pageOf(list.map((e) => {
        const s = db.users.find((u) => u.id === e.studentId);
        const cp = db.courseProgress.find((p) => p.studentId === e.studentId && p.courseId === Number(courseId));
        return {
          studentId: s.id, name: s.name, email: s.email,
          enrollmentStatus: e.status, accessStartDate: e.accessStartDate, accessEndDate: e.accessEndDate,
          progressPercentage: cp?.progressPercentage ?? 0,
        };
      }), pagination, sort, { id: (x) => x.studentId, name: (x) => x.name, email: (x) => x.email });
    }

    case "COURSE_ANALYTICS": {
      const courseId = f(filters, "courseId");
      if (courseId == null) throw badRequest("filters.courseId is required");
      requireCourseOwnershipOrAdmin(db, user, courseId);
      const active = db.enrollments.filter((e) => e.courseId === Number(courseId) && e.status === "ACTIVE").length;
      const cps = db.courseProgress.filter((p) => p.courseId === Number(courseId));
      const completed = cps.filter((p) => p.completed).length;
      const inProgress = cps.filter((p) => !p.completed && p.progressPercentage > 0).length;
      const quizIds = new Set(quizzesOfCourse(db, courseId).map((q) => q.id));
      const attempts = db.quizAttempts.filter((a) => quizIds.has(a.quizId));
      const avg = attempts.length
        ? Math.round((attempts.reduce((s, a) => s + Number(a.scorePercentage), 0) / attempts.length) * 100) / 100
        : 0;
      return {
        totalEnrolled: active, completed, inProgress,
        notStarted: Math.max(0, active - completed - inProgress),
        averageQuizScore: avg,
      };
    }

    case "ADMIN_DASHBOARD": {
      requireRole(user, "ADMIN");
      const live = db.courses.filter((c) => !c.deletedAt);
      return {
        totalCourses: live.length,
        publishedCourses: live.filter((c) => c.status === "PUBLISHED").length,
        draftCourses: live.filter((c) => c.status === "DRAFT").length,
        totalStudents: db.users.filter((u) => u.roles.includes("STUDENT")).length,
        activeStudents: db.users.filter((u) => u.roles.includes("STUDENT") && u.status === "ACTIVE").length,
        totalInstructors: db.users.filter((u) => u.roles.includes("INSTRUCTOR")).length,
        certificatesIssued: db.certificates.length,
      };
    }

    case "USERS": {
      requireRole(user, "ADMIN");
      let list = [...db.users];
      const role = f(filters, "role");
      const status = f(filters, "status");
      const search = f(filters, "search");
      if (role) list = list.filter((u) => u.roles.includes(String(role).toUpperCase()));
      if (status) list = list.filter((u) => u.status === String(status).toUpperCase());
      if (search) {
        const s = String(search).toLowerCase();
        list = list.filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
      }
      return pageOf(list.map((u) => ({
        userId: u.id, name: u.name, email: u.email, phone: u.phone,
        status: u.status, roles: [...u.roles].sort(), createdAt: u.createdAt,
      })), pagination, sort, { id: (x) => x.userId, name: (x) => x.name, email: (x) => x.email, createdAt: (x) => x.createdAt });
    }

    case "COURSES": {
      requireRole(user, "ADMIN");
      let list = db.courses.filter((c) => !c.deletedAt);
      const status = f(filters, "status");
      const instructorId = f(filters, "instructorId");
      if (status) list = list.filter((c) => c.status === String(status).toUpperCase());
      if (instructorId != null) list = list.filter((c) => c.instructorId === Number(instructorId));
      return pageOf(list.map((c) => courseSummary(db, c)), pagination, sort,
        { id: (x) => x.courseId, title: (x) => x.title, status: (x) => x.status, createdAt: (x) => x.createdAt });
    }

    case "ENROLLMENTS": {
      requireRole(user, "ADMIN");
      let list = [...db.enrollments];
      const courseId = f(filters, "courseId");
      const studentEmail = f(filters, "studentEmail");
      const status = f(filters, "status");
      if (courseId != null) list = list.filter((e) => e.courseId === Number(courseId));
      if (studentEmail) {
        const s = String(studentEmail).toLowerCase();
        list = list.filter((e) => db.users.find((u) => u.id === e.studentId)?.email.toLowerCase().includes(s));
      }
      if (status) list = list.filter((e) => e.status === String(status).toUpperCase());
      return pageOf(list.map((e) => {
        const s = db.users.find((u) => u.id === e.studentId);
        const c = courseById(db, e.courseId);
        return {
          enrollmentId: e.id, studentId: s.id, studentName: s.name, studentEmail: s.email,
          courseId: c.id, courseTitle: c.title, status: e.status,
          accessStartDate: e.accessStartDate, accessEndDate: e.accessEndDate,
          paymentMode: e.paymentMode, paymentReference: e.paymentReference, createdAt: e.createdAt,
        };
      }), pagination, sort, { id: (x) => x.enrollmentId, createdAt: (x) => x.createdAt });
    }

    case "STUDENT_PROGRESS_REPORT": {
      const courseId = f(filters, "courseId");
      const studentId = f(filters, "studentId");
      if (courseId == null) throw badRequest("filters.courseId is required");
      if (studentId == null) throw badRequest("filters.studentId is required");
      requireCourseOwnershipOrAdmin(db, user, courseId);
      const student = db.users.find((u) => u.id === Number(studentId));
      if (!student) throw notFound("Student not found: " + studentId);
      const cp = db.courseProgress.find((p) => p.studentId === student.id && p.courseId === Number(courseId));
      return {
        studentId: student.id, studentName: student.name, studentEmail: student.email,
        courseId: Number(courseId),
        courseProgressPercentage: cp?.progressPercentage ?? 0,
        completedLessons: cp?.completedLessons ?? 0,
        totalLessons: cp?.totalLessons ?? 0,
        courseCompleted: !!cp?.completed,
        videoProgress: db.videoProgress
          .filter((vp) => vp.studentId === student.id && vp.courseId === Number(courseId))
          .map((vp) => ({ lessonId: vp.lessonId, videoId: vp.videoId, lastWatchedSeconds: vp.lastWatchedSeconds,
            totalWatchedSeconds: vp.totalWatchedSeconds, progressPercentage: vp.progressPercentage, completed: vp.completed })),
        quizProgress: quizzesOfCourse(db, courseId).map((q) => {
          const attempts = db.quizAttempts.filter((a) => a.quizId === q.id && a.studentId === student.id);
          return {
            quizId: q.id, title: q.title, attempts: attempts.length,
            bestScore: attempts.length ? Math.max(...attempts.map((a) => Number(a.scorePercentage))) : 0,
            passed: attempts.some((a) => a.passed),
          };
        }),
      };
    }

    case "CERTIFICATE_REPORT": {
      requireRole(user, "ADMIN");
      let list = [...db.certificates];
      const courseId = f(filters, "courseId");
      const fromDate = f(filters, "fromDate");
      const toDate = f(filters, "toDate");
      if (courseId != null) list = list.filter((c) => c.courseId === Number(courseId));
      if (fromDate) list = list.filter((c) => c.issuedAt >= fromDate);
      if (toDate) list = list.filter((c) => c.issuedAt.slice(0, 10) <= toDate);
      return pageOf(list.map((c) => {
        const s = db.users.find((u) => u.id === c.studentId);
        return {
          certificateId: c.id, certificateCode: c.certificateCode,
          studentName: s?.name || c.recipientName, studentEmail: s?.email || "—",
          courseId: c.courseId, courseTitle: courseById(db, c.courseId)?.title || c.courseTitleSnapshot,
          issuedAt: c.issuedAt,
        };
      }), pagination, sort, { id: (x) => x.certificateId, issuedAt: (x) => x.issuedAt });
    }

    case "AUDIT_LOGS": {
      requireRole(user, "ADMIN");
      let list = [...db.auditLogs];
      const action = f(filters, "action");
      const actorId = f(filters, "actorId");
      if (action) list = list.filter((a) => a.action === action);
      if (actorId != null) list = list.filter((a) => a.actorId === Number(actorId));
      return pageOf(list.map((a) => ({ auditId: a.id, actorId: a.actorId, actorEmail: a.actorEmail,
        action: a.action, entityType: a.entityType, entityId: a.entityId, details: a.details,
        requestId: a.requestId, createdAt: a.createdAt })), pagination, sort,
        { id: (x) => x.auditId, createdAt: (x) => x.createdAt });
    }

    case "MY_DATA_EXPORT": {
      return {
        profile: { userId: user.id, name: user.name, email: user.email, status: user.status,
          roles: [...user.roles].sort(), createdAt: user.createdAt },
        enrollments: db.enrollments.filter((e) => e.studentId === user.id).map((e) => ({
          courseId: e.courseId, courseTitle: courseById(db, e.courseId)?.title,
          status: e.status, accessStartDate: e.accessStartDate, accessEndDate: e.accessEndDate, enrolledAt: e.createdAt })),
        videoProgress: db.videoProgress.filter((v) => v.studentId === user.id).map((vp) => ({
          courseId: vp.courseId, lessonId: vp.lessonId, videoId: vp.videoId,
          totalWatchedSeconds: vp.totalWatchedSeconds, progressPercentage: vp.progressPercentage, completed: vp.completed })),
        quizAttempts: db.quizAttempts.filter((a) => a.studentId === user.id).map((a) => ({
          quizId: a.quizId, attemptNumber: a.attemptNumber, scorePercentage: a.scorePercentage,
          passed: a.passed, submittedAt: a.createdAt, snapshot: a.snapshot })),
        certificates: db.certificates.filter((c) => c.studentId === user.id).map((c) => ({
          certificateCode: c.certificateCode, certificateUid: c.certificateUid,
          courseTitle: courseById(db, c.courseId)?.title || c.courseTitleSnapshot,
          recipientName: c.recipientName, issuedAt: c.issuedAt, revoked: c.revoked,
          downloadUrl: "/api/v1/certificates/download/" + c.certificateCode,
          verifyUrl: "/api/v1/public/query (VERIFY_CERTIFICATE, certificateCode=" + c.certificateCode + ")" })),
        auditTrail: db.auditLogs.filter((a) => a.actorId === user.id).slice(0, 500).map((a) => ({
          action: a.action, entityType: a.entityType, createdAt: a.createdAt })),
        exportedAt: nowIso(),
        note: "This JSON is your complete personal data export. Issued certificates are retained as immutable credentials even after account deletion.",
      };
    }

    default:
      throw badRequest("Unsupported query: " + query);
  }

  function requireCourseOwnershipOrAdmin(dbx, u, courseId) {
    const course = requireCourse(dbx, courseId);
    if (hasRole(u, "ADMIN")) return course;
    if (hasRole(u, "INSTRUCTOR") && canManageCourse(dbx, u, course)) return course;
    throw forbidden("You do not have access to this course's data");
  }
}

/** Mirrors QueryService.assertCourseReadAccess. Returns true for the student view. */
function assertCourseReadAccess(db, user, course) {
  if (course.deletedAt) throw notFound("Course not found: " + course.id);
  if (hasRole(user, "ADMIN")) return false;
  if (hasRole(user, "INSTRUCTOR") && canManageCourse(db, user, course)) return false;
  if (hasRole(user, "STUDENT")) {
    requireActiveEnrollment(db, user.id, course.id);
    return true;
  }
  throw forbidden("You do not have access to this course");
}

// ═════════════════════════════════ COMMANDS ════════════════
function handleCommand(db, { command, payload, metadata }, ctx) {
  const user = requirePrincipal(db, ctx.accessToken);
  const p = payload || {};

  // Idempotency replay (same key → same result, no re-execution)
  if (ctx.idempotencyKey && db.idempotency[ctx.idempotencyKey]) {
    const cached = db.idempotency[ctx.idempotencyKey];
    if (cached.command === command) return cached.result;
    throw conflict("IDEMPOTENCY_REUSE", "Idempotency-Key was used for a different command");
  }

  const result = routeCommand(db, user, command, p, metadata);

  if (ctx.idempotencyKey) db.idempotency[ctx.idempotencyKey] = { command, result };
  return result;
}

function routeCommand(db, user, command, p, metadata) {
  const withAudit = (details, fn) => {
    const out = fn();
    let d = details;
    if (metadata?.reason) d += "; reason=" + metadata.reason;
    audit(db, user, command, d);
    return out;
  };

  switch (command) {
    // ─── admin ───
    case "CREATE_INSTRUCTOR": {
      requireRole(user, "ADMIN");
      if (!p.name || !p.email) throw badRequest("name and email are required");
      if (db.users.some((u) => u.email.toLowerCase() === p.email.toLowerCase())) {
        throw conflict("EMAIL_EXISTS", "A user with this email already exists");
      }
      const instructor = { id: nextId(db), name: p.name, email: p.email, phone: p.phone || null,
        password: p.password || null, roles: ["INSTRUCTOR"], status: "ACTIVE",
        googleSub: null, deletionRequestedAt: null, createdAt: nowIso() };
      db.users.push(instructor);
      return withAudit(`email=${maskEmail(p.email)}; (pii-minimized)`,
        () => ({ userId: instructor.id, email: instructor.email, status: instructor.status }));
    }

    case "UPDATE_USER_STATUS": {
      requireRole(user, "ADMIN");
      const target = db.users.find((u) => u.id === Number(p.userId));
      if (!target) throw notFound("User not found: " + p.userId);
      const status = String(p.status || "").toUpperCase();
      if (!["ACTIVE", "DISABLED", "PENDING_APPROVAL"].includes(status)) throw badRequest("Invalid status: " + p.status);
      target.status = status;
      return withAudit(`payload={"userId":${target.id},"status":"${status}"}`,
        () => ({ userId: target.id, status: target.status }));
    }

    case "ENROLL_STUDENT": {
      requireRole(user, "ADMIN");
      if (!p.studentEmail || !p.courseId) throw badRequest("studentEmail and courseId are required");
      const course = requireCourse(db, p.courseId);
      let student = db.users.find((u) => u.email.toLowerCase() === p.studentEmail.toLowerCase());
      if (!student) {
        student = { id: nextId(db), name: p.studentName || p.studentEmail.split("@")[0], email: p.studentEmail,
          phone: null, password: null, roles: ["STUDENT"], status: "PENDING_APPROVAL",
          googleSub: null, deletionRequestedAt: null, createdAt: nowIso() };
        db.users.push(student);
      }
      if (db.enrollments.some((e) => e.studentId === student.id && e.courseId === course.id && e.status === "ACTIVE")) {
        throw conflict("ALREADY_ENROLLED", "Student is already enrolled in this course");
      }
      const e = { id: nextId(db), studentId: student.id, courseId: course.id, status: "ACTIVE",
        accessStartDate: p.accessStartDate || nowIso().slice(0, 10), accessEndDate: p.accessEndDate || null,
        paymentMode: p.paymentMode ? String(p.paymentMode).toUpperCase() : "OFFLINE",
        paymentReference: p.paymentReference || null, notes: p.notes || null, createdAt: nowIso() };
      db.enrollments.push(e);
      return withAudit(`courseId=${course.id}; studentEmail=${maskEmail(p.studentEmail)}; (pii-minimized)`,
        () => ({ enrollmentId: e.id, studentId: student.id, courseId: course.id,
          status: e.status, studentAccountStatus: student.status }));
    }

    case "BULK_ENROLL_STUDENTS": {
      requireRole(user, "ADMIN");
      const students = p.students || [];
      if (!p.courseId || students.length === 0) throw badRequest("courseId and students are required");
      if (students.length > 200) throw badRequest("At most 200 students per bulk enrollment request");
      const course = requireCourse(db, p.courseId);
      const ids = [];
      for (const s of students) {
        if (!s.email) continue;
        let student = db.users.find((u) => u.email.toLowerCase() === s.email.toLowerCase());
        if (!student) {
          student = { id: nextId(db), name: s.name || s.email.split("@")[0], email: s.email, phone: null,
            password: null, roles: ["STUDENT"], status: "PENDING_APPROVAL", googleSub: null,
            deletionRequestedAt: null, createdAt: nowIso() };
          db.users.push(student);
        }
        if (!db.enrollments.some((e) => e.studentId === student.id && e.courseId === course.id && e.status === "ACTIVE")) {
          const e = { id: nextId(db), studentId: student.id, courseId: course.id, status: "ACTIVE",
            accessStartDate: p.accessStartDate || nowIso().slice(0, 10), accessEndDate: p.accessEndDate || null,
            paymentMode: "OFFLINE", paymentReference: null, notes: null, createdAt: nowIso() };
          db.enrollments.push(e);
          ids.push(e.id);
        }
      }
      return withAudit(`courseId=${course.id}; studentCount=${students.length}; (pii-minimized)`,
        () => ({ courseId: course.id, requested: students.length, enrolled: ids.length, enrollmentIds: ids }));
    }

    case "UNENROLL_STUDENT": {
      requireRole(user, "ADMIN");
      const e = db.enrollments.find((x) => x.studentId === Number(p.studentId) && x.courseId === Number(p.courseId));
      if (!e) throw notFound("Enrollment not found");
      e.status = "UNENROLLED";
      return withAudit(`payload={"studentId":${p.studentId},"courseId":${p.courseId}}`,
        () => ({ enrollmentId: e.id, status: e.status }));
    }

    case "PUBLISH_COURSE": {
      requireRole(user, "ADMIN");
      const course = requireCourse(db, p.courseId);
      if (trackedLessons(db, course.id).length === 0 && lessonsOfCourse(db, course.id).length === 0) {
        throw businessRule("EMPTY_COURSE", "A course needs at least one lesson before publishing");
      }
      course.status = "PUBLISHED";
      return withAudit(`payload={"courseId":${course.id}}`, () => ({ courseId: course.id, status: course.status }));
    }

    case "UNPUBLISH_COURSE": {
      requireRole(user, "ADMIN");
      const course = requireCourse(db, p.courseId);
      course.status = "UNPUBLISHED";
      return withAudit(`payload={"courseId":${course.id}}`, () => ({ courseId: course.id, status: course.status }));
    }

    case "ASSIGN_INSTRUCTORS": {
      requireRole(user, "ADMIN");
      const course = requireCourse(db, p.courseId);
      const emails = p.instructorEmails || [];
      const assigned = [];
      db.courseInstructors = db.courseInstructors.filter((ci) => ci.courseId !== course.id);
      for (const email of emails) {
        let inst = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!inst) {
          inst = { id: nextId(db), name: email.split("@")[0], email, phone: null, password: null,
            roles: ["INSTRUCTOR"], status: "PENDING_APPROVAL", googleSub: null,
            deletionRequestedAt: null, createdAt: nowIso() };
          db.users.push(inst);
        } else if (!inst.roles.includes("INSTRUCTOR")) {
          inst.roles.push("INSTRUCTOR");
        }
        if (inst.id !== course.instructorId) {
          db.courseInstructors.push({ courseId: course.id, userId: inst.id });
        }
        assigned.push({ userId: inst.id, email: inst.email, accountStatus: inst.status });
      }
      return withAudit(`courseId=${course.id}; instructorCount=${emails.length}; (pii-minimized)`,
        () => ({ courseId: course.id, instructors: assigned }));
    }

    case "ARCHIVE_COURSE": {
      requireRole(user, "ADMIN");
      const course = requireCourse(db, p.courseId);
      course.status = "ARCHIVED";
      return withAudit(`payload={"courseId":${course.id}}`, () => ({ courseId: course.id, status: course.status }));
    }

    case "SOFT_DELETE_COURSE": {
      requireRole(user, "ADMIN");
      const course = requireCourse(db, p.courseId);
      course.deletedAt = nowIso();
      return withAudit(`payload={"courseId":${course.id}}`,
        () => ({ courseId: course.id, status: course.status, deletedAt: course.deletedAt, hardDeleteAfterDays: 60 }));
    }

    case "DELETE_COURSE": {
      requireRole(user, "ADMIN");
      const course = courseById(db, p.courseId);
      if (!course) throw notFound("Course not found: " + p.courseId);
      const enrollmentCount = db.enrollments.filter((e) => e.courseId === course.id).length;
      const certCount = db.certificates.filter((c) => c.courseId === course.id).length;
      if (enrollmentCount > 0 || certCount > 0) {
        throw businessRule("COURSE_IN_USE",
          `Course has ${enrollmentCount} enrollment(s) and ${certCount} certificate(s) — archive or soft-delete instead`);
      }
      const modIds = new Set(modulesOf(db, course.id).map((m) => m.id));
      db.lessons = db.lessons.filter((l) => !modIds.has(l.moduleId));
      db.modules = db.modules.filter((m) => m.courseId !== course.id);
      db.videos = db.videos.filter((v) => v.courseId !== course.id);
      db.courses = db.courses.filter((c) => c.id !== course.id);
      return withAudit(`payload={"courseId":${p.courseId}}`, () => ({ courseId: course.id, deleted: true }));
    }

    case "ADMIN_ISSUE_CERTIFICATE": {
      requireRole(user, "ADMIN");
      const cert = db.certificates.find((c) => c.studentId === Number(p.studentId) && c.courseId === Number(p.courseId));
      if (!cert) throw notFound("No certificate exists for this student/course - the student must be eligible and issue first");
      if (p.recipientName) cert.recipientName = p.recipientName.trim();
      cert.issuedBy = user.id;
      cert.version += 1;
      cert.revoked = false;
      cert.revokedAt = null;
      return withAudit(`payload={"studentId":${p.studentId},"courseId":${p.courseId}}`,
        () => ({ certificateId: cert.id, certificateCode: cert.certificateCode,
          downloadUrl: "/api/v1/certificates/download/" + cert.certificateCode }));
    }

    case "REVOKE_CERTIFICATE": {
      requireRole(user, "ADMIN");
      const cert = db.certificates.find((c) => c.certificateCode === p.certificateCode || c.certificateUid === p.certificateCode);
      if (!cert) throw notFound("Certificate not found");
      cert.revoked = true;
      cert.revokedAt = nowIso();
      return withAudit(`payload={"certificateCode":"${cert.certificateCode}"}`,
        () => ({ certificateCode: cert.certificateCode, revoked: true }));
    }

    case "REQUEST_ACCOUNT_DELETION": {
      user.status = "DELETION_REQUESTED";
      user.deletionRequestedAt = nowIso();
      return withAudit("payload={}", () => ({
        userId: user.id, status: user.status, deletionRequestedAt: user.deletionRequestedAt, graceDays: 7,
        note: "Issued certificates are retained as immutable credentials. Export your data with the MY_DATA_EXPORT query before the grace period ends.",
      }));
    }

    case "CANCEL_ACCOUNT_DELETION": {
      if (user.status === "DELETION_REQUESTED") {
        user.status = "ACTIVE";
        user.deletionRequestedAt = null;
      }
      return withAudit("payload={}", () => ({ userId: user.id, status: user.status }));
    }

    // ─── instructor / admin ───
    case "CREATE_COURSE": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      if (!p.title) throw badRequest("title is required");
      const c = { id: nextId(db), title: p.title, description: p.description || null,
        category: p.category || null, level: p.level ? String(p.level).toUpperCase() : null,
        language: p.language || null, courseType: p.courseType ? String(p.courseType).toUpperCase() : "PAID",
        status: "DRAFT", passingPercentage: p.passingPercentage ?? 70,
        instructorId: user.id, deletedAt: null, createdAt: nowIso() };
      db.courses.push(c);
      return withAudit(`payload={"title":"${p.title}"}`, () => ({ courseId: c.id, title: c.title, status: c.status }));
    }

    case "UPDATE_COURSE": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const course = requireOwnedCourse(db, user, p.courseId);
      if (p.title) course.title = p.title;
      if (p.description !== undefined && p.description !== null) course.description = p.description;
      if (p.category !== undefined && p.category !== null) course.category = p.category;
      if (p.level) course.level = String(p.level).toUpperCase();
      if (p.language) course.language = p.language;
      if (p.passingPercentage != null) course.passingPercentage = p.passingPercentage;
      if (p.courseType) course.courseType = String(p.courseType).toUpperCase();
      return withAudit(`payload={"courseId":${course.id}}`,
        () => ({ courseId: course.id, title: course.title, status: course.status }));
    }

    case "CREATE_MODULE": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const course = requireOwnedCourse(db, user, p.courseId);
      if (!p.title) throw badRequest("title is required");
      const m = { id: nextId(db), courseId: course.id, title: p.title,
        description: p.description || null, displayOrder: p.displayOrder ?? 1 };
      db.modules.push(m);
      return { moduleId: m.id, courseId: course.id, title: m.title };
    }

    case "UPDATE_MODULE": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const m = db.modules.find((x) => x.id === Number(p.moduleId));
      if (!m) throw notFound("Module not found: " + p.moduleId);
      requireOwnedCourse(db, user, m.courseId);
      if (p.title) m.title = p.title;
      if (p.description !== undefined && p.description !== null) m.description = p.description;
      if (p.displayOrder != null) m.displayOrder = p.displayOrder;
      return { moduleId: m.id, title: m.title };
    }

    case "DELETE_MODULE": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const m = db.modules.find((x) => x.id === Number(p.moduleId));
      if (!m) throw notFound("Module not found: " + p.moduleId);
      requireOwnedCourse(db, user, m.courseId);
      db.lessons = db.lessons.filter((l) => l.moduleId !== m.id);
      db.modules = db.modules.filter((x) => x.id !== m.id);
      return { moduleId: m.id, deleted: true };
    }

    case "CREATE_LESSON": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const m = db.modules.find((x) => x.id === Number(p.moduleId));
      if (!m) throw notFound("Module not found: " + p.moduleId);
      requireOwnedCourse(db, user, m.courseId);
      if (!p.title) throw badRequest("title is required");
      const type = p.lessonType ? String(p.lessonType).toUpperCase() : "VIDEO";
      if (!["VIDEO", "ARTICLE", "RESOURCE"].includes(type)) throw badRequest("Invalid lessonType: " + p.lessonType);
      const l = { id: nextId(db), moduleId: m.id, title: p.title, description: p.description || null,
        displayOrder: p.displayOrder ?? 1, isMandatory: p.isMandatory == null ? true : !!p.isMandatory,
        lessonType: type, contentText: p.contentText || null, videoId: null };
      db.lessons.push(l);
      return { lessonId: l.id, moduleId: m.id, title: l.title, lessonType: l.lessonType };
    }

    case "UPDATE_LESSON": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const l = requireLesson(db, p.lessonId);
      requireOwnedCourse(db, user, lessonCourse(db, l).id);
      if (p.title) l.title = p.title;
      if (p.description !== undefined && p.description !== null) l.description = p.description;
      if (p.displayOrder != null) l.displayOrder = p.displayOrder;
      if (p.isMandatory != null) l.isMandatory = !!p.isMandatory;
      if (p.lessonType) l.lessonType = String(p.lessonType).toUpperCase();
      if (p.contentText !== undefined && p.contentText !== null) l.contentText = p.contentText;
      return { lessonId: l.id, title: l.title, lessonType: l.lessonType };
    }

    case "DELETE_LESSON": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const l = requireLesson(db, p.lessonId);
      requireOwnedCourse(db, user, lessonCourse(db, l).id);
      db.lessons = db.lessons.filter((x) => x.id !== l.id);
      return { lessonId: l.id, deleted: true };
    }

    case "ATTACH_VIDEO_TO_LESSON": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const l = requireLesson(db, p.lessonId);
      const course = requireOwnedCourse(db, user, lessonCourse(db, l).id);
      const v = videoById(db, p.videoId);
      if (!v) throw notFound("Video not found: " + p.videoId);
      if (v.courseId !== course.id) throw businessRule("LESSON_COURSE_MISMATCH", "Video belongs to a different course");
      l.videoId = v.id;
      v.lessonId = l.id;
      return { lessonId: l.id, videoId: v.id };
    }

    case "CREATE_OR_UPDATE_QUIZ": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const l = requireLesson(db, p.lessonId);
      requireOwnedCourse(db, user, lessonCourse(db, l).id);
      if (!p.title || !p.questions?.length) throw badRequest("title and questions are required");
      for (const q of p.questions) {
        if (!q.questionText) throw badRequest("questionText is required");
        if (!q.options || q.options.length < 2) throw badRequest("Each question needs at least 2 options");
        const correct = q.options.filter((o) => o.isCorrect).length;
        if (correct === 0) throw badRequest("Each question needs at least one correct option");
        const type = (q.questionType || "SINGLE_CORRECT").toUpperCase();
        if (type === "SINGLE_CORRECT" && correct > 1) {
          throw badRequest("SINGLE_CORRECT questions must have exactly one correct option");
        }
      }
      let quiz = quizByLesson(db, l.id);
      if (!quiz) {
        quiz = { id: nextId(db), lessonId: l.id, title: "", passingPercentage: 70, maxAttempts: 3, questions: [] };
        db.quizzes.push(quiz);
      }
      quiz.title = p.title;
      if (p.passingPercentage != null) quiz.passingPercentage = p.passingPercentage;
      if (p.maxAttempts != null) quiz.maxAttempts = p.maxAttempts;
      quiz.questions = p.questions.map((q, qi) => ({
        id: nextId(db), questionText: q.questionText,
        questionType: (q.questionType || "SINGLE_CORRECT").toUpperCase(),
        marks: q.marks ?? 1, displayOrder: q.displayOrder ?? qi,
        options: q.options.map((o) => ({ id: nextId(db), optionText: o.optionText, isCorrect: !!o.isCorrect })),
      }));
      return withAudit(`payload={"lessonId":${l.id}}`,
        () => ({ quizId: quiz.id, lessonId: l.id, questionCount: quiz.questions.length }));
    }

    case "SUBMIT_COURSE_FOR_REVIEW": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const course = requireOwnedCourse(db, user, p.courseId);
      if (course.status !== "DRAFT" && course.status !== "UNPUBLISHED") {
        throw businessRule("INVALID_STATUS", "Only DRAFT or UNPUBLISHED courses can be submitted for review");
      }
      course.status = "IN_REVIEW";
      return { courseId: course.id, status: course.status };
    }

    // ─── student ───
    case "SUBMIT_QUIZ_ATTEMPT": {
      requireRole(user, "STUDENT");
      const quiz = db.quizzes.find((q) => q.id === Number(p.quizId));
      if (!quiz) throw notFound("Quiz not found: " + p.quizId);
      const course = lessonCourse(db, requireLesson(db, quiz.lessonId));
      requireActiveEnrollment(db, user.id, course.id);

      const previous = db.quizAttempts.filter((a) => a.quizId === quiz.id && a.studentId === user.id).length;
      if (previous >= quiz.maxAttempts) {
        throw businessRule("MAX_ATTEMPTS_REACHED", `Maximum attempts (${quiz.maxAttempts}) reached for this quiz`);
      }

      const answers = p.answers || [];
      let totalMarks = 0, earnedMarks = 0, correctCount = 0;
      const review = [];
      for (const q of quiz.questions) {
        totalMarks += q.marks;
        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort((a, b) => a - b);
        const validIds = new Set(q.options.map((o) => o.id));
        const selected = (answers.find((a) => Number(a.questionId) === q.id)?.selectedOptionIds || [])
          .map(Number).sort((a, b) => a - b);
        if (selected.some((id) => !validIds.has(id))) {
          throw badRequest("Answer contains option ids that do not belong to question " + q.id);
        }
        const isCorrect = correctIds.length > 0 &&
          selected.length === correctIds.length && selected.every((id, i) => id === correctIds[i]);
        if (isCorrect) { earnedMarks += q.marks; correctCount++; }
        review.push({ questionId: q.id, questionText: q.questionText,
          selectedOptionIds: selected, correctOptionIds: correctIds, correct: isCorrect });
      }
      const score = totalMarks === 0 ? 0 : Math.round((earnedMarks * 100 / totalMarks) * 100) / 100;
      const attempt = { id: nextId(db), quizId: quiz.id, studentId: user.id, attemptNumber: previous + 1,
        scorePercentage: score, passed: score >= quiz.passingPercentage,
        correctAnswers: correctCount, totalQuestions: quiz.questions.length,
        snapshot: JSON.stringify({ quizId: quiz.id, quizTitle: quiz.title,
          passingPercentage: quiz.passingPercentage, scorePercentage: score }),
        createdAt: nowIso() };
      db.quizAttempts.push(attempt);
      return { attemptId: attempt.id, scorePercentage: score, passed: attempt.passed,
        correctAnswers: correctCount, totalQuestions: quiz.questions.length, review };
    }

    case "GENERATE_CERTIFICATE": {
      requireRole(user, "STUDENT");
      if (p.recipientNameConfirmation != null && p.recipientNameConfirmation !== p.recipientName) {
        throw badRequest("recipientName and recipientNameConfirmation do not match");
      }
      const course = requireCourse(db, p.courseId);
      requireActiveEnrollment(db, user.id, course.id);
      const existing = db.certificates.find((c) => c.studentId === user.id && c.courseId === course.id);
      if (existing) throw conflict("CERTIFICATE_EXISTS", "Certificate already generated: " + existing.certificateCode);
      if (!allMandatoryCompleted(db, user.id, course.id)) {
        throw businessRule("VIDEOS_INCOMPLETE", "All mandatory videos must be completed before generating a certificate");
      }
      if (!hasPassedAllQuizzes(db, user.id, course.id)) {
        throw businessRule("QUIZ_NOT_PASSED", "All course quizzes must be passed before generating a certificate");
      }
      const cert = { id: nextId(db), studentId: user.id, courseId: course.id,
        certificateCode: "", certificateUid: crypto.randomUUID ? crypto.randomUUID() : "uid-" + Date.now(),
        recipientName: p.recipientName?.trim() || user.name, courseTitleSnapshot: course.title,
        issuedAt: nowIso(), issuedBy: null, revoked: false, revokedAt: null, version: 1 };
      cert.certificateCode = `CERT-${new Date().getFullYear()}-${String(cert.id).padStart(6, "0")}`;
      db.certificates.push(cert);
      return withAudit(`payload={"courseId":${course.id}}`, () => ({
        certificateId: cert.id, certificateCode: cert.certificateCode,
        downloadUrl: "/api/v1/certificates/download/" + cert.certificateCode }));
    }

    case "ENROLL_SELF": {
      requireRole(user, "STUDENT");
      const course = requireCourse(db, p.courseId);
      if (course.status !== "PUBLISHED") throw forbidden("Course is not published");
      if (course.courseType !== "FREE") {
        throw businessRule("SELF_ENROLL_NOT_ALLOWED", "Only FREE courses support self-enrollment — paid courses are enrolled by an admin");
      }
      if (db.enrollments.some((e) => e.studentId === user.id && e.courseId === course.id && e.status === "ACTIVE")) {
        throw conflict("ALREADY_ENROLLED", "You are already enrolled in this course");
      }
      const e = { id: nextId(db), studentId: user.id, courseId: course.id, status: "ACTIVE",
        accessStartDate: nowIso().slice(0, 10), accessEndDate: null,
        paymentMode: "FREE", paymentReference: null, notes: null, createdAt: nowIso() };
      db.enrollments.push(e);
      return withAudit(`payload={"courseId":${course.id}}`,
        () => ({ enrollmentId: e.id, courseId: course.id, status: e.status }));
    }

    default:
      throw badRequest("Unsupported command: " + command);
  }
}

// ═════════════════════════════════ MEDIA ═══════════════════
function handleMedia(db, { command, payload }, ctx) {
  const user = requirePrincipal(db, ctx.accessToken);
  const p = payload || {};

  switch (command) {
    case "CREATE_VIDEO_UPLOAD_URL": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const course = requireOwnedCourse(db, user, p.courseId);
      if (course.status === "ARCHIVED") throw businessRule("COURSE_ARCHIVED", "Cannot upload videos to an archived course");
      if (!["video/mp4", "video/webm"].includes(p.contentType)) {
        throw badRequest("Content type not allowed: " + p.contentType + ". Allowed: [video/mp4, video/webm]");
      }
      if (!p.fileSizeBytes || p.fileSizeBytes <= 0) throw badRequest("File size must be at least 1 byte");
      const v = { id: nextId(db), courseId: course.id, lessonId: p.lessonId ? Number(p.lessonId) : null,
        fileName: (p.fileName || "video").replace(/[^A-Za-z0-9._-]/g, "_"), contentType: p.contentType,
        fileSizeBytes: p.fileSizeBytes, durationSeconds: p.durationSeconds || 0,
        status: "PENDING_UPLOAD", s3Key: "", sourceUrl: null };
      v.s3Key = `courses/${course.id}/lessons/${p.lessonId || "unassigned"}/videos/${v.id}.mp4`;
      db.videos.push(v);
      return { videoId: v.id, uploadUrl: "mock://upload/" + v.id, s3Key: v.s3Key, expiresInSeconds: 900 };
    }

    case "COMPLETE_VIDEO_UPLOAD": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const v = videoById(db, p.videoId);
      if (!v) throw notFound("Video not found: " + p.videoId);
      requireOwnedCourse(db, user, v.courseId);
      if (v.s3Key !== p.s3Key) throw badRequest("s3Key does not match this video");
      if (p.durationSeconds > 0) v.durationSeconds = p.durationSeconds;
      if (!v.durationSeconds) throw badRequest("durationSeconds must be provided to complete the upload");
      v.status = "READY";
      return { videoId: v.id, status: v.status };
    }

    case "GET_VIDEO_PLAYBACK_URL": {
      if (!hasRole(user, "STUDENT")) throw forbidden("Only students can request playback URLs");
      const v = videoById(db, p.videoId);
      if (!v) throw notFound("Video not found: " + p.videoId);
      if (v.courseId !== Number(p.courseId)) throw forbidden("Video does not belong to this course");
      const lesson = requireLesson(db, p.lessonId);
      if (lesson.videoId !== v.id) throw forbidden("Video is not attached to this lesson");
      const course = courseById(db, v.courseId);
      if (course.status !== "PUBLISHED") throw forbidden("Course is not published");
      if (v.status !== "READY") throw businessRule("VIDEO_NOT_READY", "Video is not ready for playback");
      requireActiveEnrollment(db, user.id, v.courseId);
      const vp = db.videoProgress.find((x) => x.studentId === user.id && x.videoId === v.id);
      const blob = typeof window !== "undefined" && window.__mockVideoBlobs?.[v.id];
      return { videoId: v.id, playbackUrl: blob || v.sourceUrl || "", expiresInSeconds: 300,
        lastWatchedSeconds: vp?.lastWatchedSeconds ?? 0 };
    }

    case "DELETE_VIDEO": {
      requireAnyRole(user, "INSTRUCTOR", "ADMIN");
      const v = videoById(db, p.videoId);
      if (!v) throw notFound("Video not found: " + p.videoId);
      requireOwnedCourse(db, user, v.courseId);
      db.lessons.forEach((l) => { if (l.videoId === v.id) l.videoId = null; });
      db.videos = db.videos.filter((x) => x.id !== v.id);
      audit(db, user, "DELETE_VIDEO", `payload={"videoId":${v.id}}`);
      return { videoId: v.id, deleted: true };
    }

    default:
      throw badRequest("Unsupported media command: " + command);
  }
}

// ═════════════════════════════════ TRACKING ════════════════
function handleTracking(db, { event, payload }, ctx) {
  const user = requirePrincipal(db, ctx.accessToken);
  if (!hasRole(user, "STUDENT")) throw forbidden("Only students can send tracking events");
  const p = payload || {};

  if (event === "MARK_LESSON_COMPLETE") {
    requireActiveEnrollment(db, user.id, p.courseId);
    const lesson = requireLesson(db, p.lessonId);
    const course = lessonCourse(db, lesson);
    if (course.id !== Number(p.courseId)) throw forbidden("Lesson does not belong to this course");
    if (lesson.lessonType === "VIDEO") {
      throw businessRule("VIDEO_LESSON", "Video lessons complete through watch time, not mark-as-read");
    }
    if (course.status !== "PUBLISHED") throw forbidden("Course is not published");
    if (!db.lessonCompletions.some((lc) => lc.studentId === user.id && lc.lessonId === lesson.id)) {
      db.lessonCompletions.push({ studentId: user.id, courseId: course.id, lessonId: lesson.id, completedAt: nowIso() });
    }
    const coursePct = recomputeCourseProgress(db, user.id, course.id);
    return { lessonId: lesson.id, completed: true, courseProgressPercentage: coursePct };
  }

  if (event !== "VIDEO_HEARTBEAT" && event !== "VIDEO_COMPLETED") {
    throw badRequest("Unsupported tracking event: " + event);
  }

  requireActiveEnrollment(db, user.id, p.courseId);
  const video = videoById(db, p.videoId);
  if (!video) throw notFound("Video not found: " + p.videoId);
  if (video.courseId !== Number(p.courseId)) throw forbidden("Video does not belong to this course");
  const lesson = requireLesson(db, p.lessonId);
  const course = lessonCourse(db, lesson);
  if (course.id !== Number(p.courseId)) throw forbidden("Lesson does not belong to this course");
  if (course.status !== "PUBLISHED") throw forbidden("Course is not published");

  let vp = db.videoProgress.find((x) => x.studentId === user.id && x.videoId === video.id);
  if (!vp) {
    vp = { studentId: user.id, courseId: course.id, lessonId: lesson.id, videoId: video.id,
      lastWatchedSeconds: 0, totalWatchedSeconds: 0, progressPercentage: 0, completed: false };
    db.videoProgress.push(vp);
  }
  const duration = Math.max(video.durationSeconds, 1);
  const delta = event === "VIDEO_HEARTBEAT"
    ? Math.max(0, Math.min(p.watchedDeltaSeconds || 0, MAX_DELTA_SECONDS))
    : 0;
  vp.totalWatchedSeconds = Math.min(vp.totalWatchedSeconds + delta, duration);
  vp.lastWatchedSeconds = Math.max(0, Math.min(p.currentPositionSeconds || 0, duration));
  let pct = Math.min(100, Math.floor((vp.totalWatchedSeconds * 100) / duration));
  if (!vp.completed && pct >= COMPLETION_THRESHOLD) {
    vp.completed = true;
    pct = 100;
  }
  vp.progressPercentage = vp.completed ? 100 : pct;

  const coursePct = recomputeCourseProgress(db, user.id, course.id);
  return { lastWatchedSeconds: vp.lastWatchedSeconds, totalWatchedSeconds: vp.totalWatchedSeconds,
    videoProgressPercentage: vp.progressPercentage, videoCompleted: vp.completed,
    courseProgressPercentage: coursePct };
}

// ═════════════════════════════════ PUBLIC ══════════════════
function handlePublic(db, { query, filters }) {
  if (query !== "VERIFY_CERTIFICATE") throw badRequest("Unsupported public query: " + query);
  const code = filters?.certificateCode || filters?.certificateUid;
  if (!code) throw badRequest("filters.certificateCode or filters.certificateUid is required");
  const cert = db.certificates.find((c) => c.certificateCode === code || c.certificateUid === code);
  if (!cert) {
    return { valid: false, revoked: false, studentName: null, courseTitle: null,
      issuedAt: null, certificateCode: code, certificateUid: null };
  }
  const student = db.users.find((u) => u.id === cert.studentId);
  return {
    valid: !cert.revoked, revoked: cert.revoked,
    studentName: cert.recipientName || student?.name || "—",
    courseTitle: courseById(db, cert.courseId)?.title || cert.courseTitleSnapshot,
    issuedAt: cert.issuedAt.slice(0, 10),
    certificateCode: cert.certificateCode, certificateUid: cert.certificateUid,
  };
}

// ═════════════════════════════════ ENTRY ═══════════════════
export async function mockDispatch(channel, body, ctx) {
  await sleep(LATENCY_MS);
  const db = loadDb();
  try {
    let result;
    switch (channel) {
      case "session": result = handleSession(db, body, ctx); break;
      case "query": result = handleQuery(db, body, ctx); break;
      case "command": result = handleCommand(db, body, ctx); break;
      case "media": result = handleMedia(db, body, ctx); break;
      case "tracking": result = handleTracking(db, body, ctx); break;
      case "public": result = handlePublic(db, body); break;
      default: throw badRequest("Unknown channel: " + channel);
    }
    saveDb(db);
    return result;
  } catch (err) {
    saveDb(db); // persist side-effects made before the failure (mirrors real tx boundaries loosely)
    throw err;
  }
}

/** Simulated presigned-PUT upload: registers a session blob for playback. */
export async function mockUpload(uploadUrl, file, onProgress) {
  const videoId = Number(uploadUrl.replace("mock://upload/", ""));
  for (let pctDone = 0; pctDone <= 100; pctDone += 20) {
    await sleep(120);
    if (onProgress) onProgress(pctDone);
  }
  if (typeof window !== "undefined" && file) {
    window.__mockVideoBlobs = window.__mockVideoBlobs || {};
    window.__mockVideoBlobs[videoId] = URL.createObjectURL(file);
  }
}
