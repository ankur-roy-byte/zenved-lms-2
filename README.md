# ZenVed LMS — Frontend

Next.js 14 frontend for the **LMS backend** (`LMS-Bacckend-java`, Java 21 / Spring Boot).
It speaks the backend's exact minimal **command/query protocol** — 7 endpoints, envelope
responses, JWT + refresh rotation, idempotency keys — and ships a complete in-browser
**demo mode** so the whole product can be run and clicked through with zero infrastructure.

## Two modes

| Mode | What it does | When |
|---|---|---|
| **mock** | Every screen runs against seeded demo data in `localStorage`, served by an in-browser implementation of the same API contract (`lib/mock/server.js`). | Default in `npm run dev`. Never available in production builds unless `NEXT_PUBLIC_ALLOW_MOCK=true`. |
| **live** | Real HTTP against the Spring Boot backend: `POST /api/v1/auth/session`, `/lms/query`, `/lms/command`, `/media/command`, `/tracking/event`, `/public/query` + certificate PDF download. | Default in `next build` / production. |

Mode resolution lives in `lib/config.js`; the mock module is lazily imported, so live
builds don't execute demo data.

```bash
npm install
npm run dev            # demo mode on http://localhost:3000
```

Live mode against a local backend:

```bash
# .env.local
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same client id the backend verifies>
```

Backend prerequisites for live mode: `CORS_ALLOWED_ORIGINS` must include this app's
origin, and `GOOGLE_CLIENT_ID` must match. Admin password login works with the backend's
bootstrap admin. (In the backend's `local` profile, Google login accepts mock tokens —
the demo personas use the same `mock:<email>:<name>` format.)

## Demo identities (mock mode)

- Password login: `admin@lms.local` / `Admin@12345`
- Google (persona buttons on /login): Ananya (completed course + certificate),
  Vikram (mid-course, failed quiz attempt), Sara (pending invite), Rahul (instructor),
  Meera (co-instructor), Priya (admin via allowlist), plus an unknown user that the
  backend correctly **rejects** (no enrollment).

## What's implemented (mapped to backend features)

- **Auth**: LOGIN_GOOGLE (real Google Identity Services in live mode), LOGIN_PASSWORD,
  ME, LOGOUT, automatic REFRESH_TOKEN rotation with single-flight retry on 401.
- **Student**: MY_COURSES (+ enrollment status), COURSE_CATALOG with ENROLL_SELF for
  FREE courses, course player with modules → lessons, **VIDEO lessons** (playback URLs
  via GET_VIDEO_PLAYBACK_URL, resume position, VIDEO_HEARTBEAT every 20s with clamped
  deltas, VIDEO_COMPLETED, ≥90% completion), **ARTICLE/RESOURCE lessons**
  (contentText + MARK_LESSON_COMPLETE), **quizzes** (QUIZ_DETAIL without answers,
  SUBMIT_QUIZ_ATTEMPT with Idempotency-Key, post-submit answer review, attempt
  history/limits), **certificates** (GENERATE_CERTIFICATE with recipient-name
  double-confirm, download PDF, printable view), MY_CERTIFICATES.
- **Instructor**: INSTRUCTOR_COURSES (owned + assigned), CREATE/UPDATE_COURSE, module &
  lesson CRUD incl. lesson types, **video upload flow** (CREATE_VIDEO_UPLOAD_URL →
  presigned PUT with progress → COMPLETE_VIDEO_UPLOAD → ATTACH_VIDEO_TO_LESSON),
  DELETE_VIDEO, **quiz builder** (single/multiple-correct, marks, pass %, max attempts —
  replaces the question set), SUBMIT_COURSE_FOR_REVIEW, COURSE_STUDENTS,
  STUDENT_PROGRESS_REPORT, COURSE_ANALYTICS. Publishing is admin-only, as designed.
- **Admin**: ADMIN_DASHBOARD, course lifecycle (PUBLISH / UNPUBLISH / ARCHIVE /
  SOFT_DELETE / DELETE), ASSIGN_INSTRUCTORS (replace-set), USERS (search/filter,
  CREATE_INSTRUCTOR, UPDATE_USER_STATUS), ENROLLMENTS (ENROLL_STUDENT invite flow,
  BULK_ENROLL_STUDENTS, UNENROLL_STUDENT, pending-vs-active view), reports
  (COURSE_ANALYTICS, STUDENT_PROGRESS_REPORT, CERTIFICATE_REPORT),
  certificate admin (ADMIN_ISSUE_CERTIFICATE re-issue, REVOKE_CERTIFICATE), AUDIT_LOGS.
- **Privacy (DPDP/GDPR)**: MY_DATA_EXPORT (downloads JSON), REQUEST_ACCOUNT_DELETION
  with grace window + CANCEL_ACCOUNT_DELETION (Account & privacy page).
- **Public**: `/verify` + `/verify/[code]` — VERIFY_CERTIFICATE without auth (QR target),
  including the revoked state; `/certificate/[code]` printable view + official PDF link.

## Project layout

```
lib/config.js        mode & env resolution (mock gated off in production)
lib/api.js           API client: envelope, tokens, refresh rotation, idempotency keys
lib/errors.js        ApiError + display helper
lib/mock/data.js     seeded demo entities (backend-shaped)
lib/mock/server.js   in-browser implementation of the full API contract
components/Shell.js  authenticated frame (ME-driven role routing)
components/ui.js     useAsync, Modal, Pager, StatusChip, toast, formatters
app/…                login, student (+player), instructor (+builder), admin/*,
                     account, verify, certificate
```

## Notes

- Commands that the backend requires an `Idempotency-Key` for (enroll, bulk-enroll,
  quiz submit, certificate, upload create/complete) get one automatically.
- 401 responses trigger one refresh + retry; refresh failure (rotation reuse detection)
  clears the session and returns to /login.
- The heartbeat cadence (20s) stays inside the backend's 10/min/video rate limit.
