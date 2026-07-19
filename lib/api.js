// ─────────────────────────────────────────────────────────────
// LMS API client. One facade, two transports:
//
//  live — speaks the backend's exact 7-endpoint protocol:
//    POST /api/v1/auth/session      {action, payload}
//    POST /api/v1/lms/query         {query, filters, pagination, sort}
//    POST /api/v1/lms/command       {command, payload, metadata} (+ Idempotency-Key)
//    POST /api/v1/media/command     {command, payload}           (+ Idempotency-Key)
//    POST /api/v1/tracking/event    {event, payload}
//    POST /api/v1/public/query      {query, filters}   (no auth)
//    GET  /api/v1/certificates/download/{code}
//  Every response is the envelope {success, code, message, data, errors, requestId}.
//
//  mock — same contract served from in-browser demo data
//  (lib/mock/server.js, loaded lazily so live builds never ship it).
// ─────────────────────────────────────────────────────────────
import { API_BASE_URL, IS_MOCK } from "./config";
import { ApiError } from "./errors";

const ACCESS_KEY = "lms_access_token";
const REFRESH_KEY = "lms_refresh_token";
const USER_KEY = "lms_user";

// ── token / session storage ─────────────────────────────────
function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAccessToken() {
  return storage()?.getItem(ACCESS_KEY) || null;
}

export function getRefreshToken() {
  return storage()?.getItem(REFRESH_KEY) || null;
}

export function getCachedUser() {
  try {
    const raw = storage()?.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(authResult) {
  const s = storage();
  if (!s || !authResult) return;
  if (authResult.accessToken) s.setItem(ACCESS_KEY, authResult.accessToken);
  if (authResult.refreshToken) s.setItem(REFRESH_KEY, authResult.refreshToken);
  if (authResult.user) s.setItem(USER_KEY, JSON.stringify(authResult.user));
}

export function clearSession() {
  const s = storage();
  if (!s) return;
  s.removeItem(ACCESS_KEY);
  s.removeItem(REFRESH_KEY);
  s.removeItem(USER_KEY);
}

/** Highest-privilege role decides where the user lands. */
export function primaryRole(user) {
  const roles = user?.roles || [];
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("INSTRUCTOR")) return "INSTRUCTOR";
  if (roles.includes("STUDENT")) return "STUDENT";
  return null;
}

export function roleHome(user) {
  switch (primaryRole(user)) {
    case "ADMIN": return "/admin";
    case "INSTRUCTOR": return "/instructor";
    case "STUDENT": return "/student";
    default: return "/login";
  }
}

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "idem-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function newRequestId() {
  return "web-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── mock transport (lazy) ───────────────────────────────────
let mockModulePromise = null;
function mock() {
  if (!mockModulePromise) mockModulePromise = import("./mock/server");
  return mockModulePromise;
}

// ── live transport ──────────────────────────────────────────
let refreshInFlight = null;

async function parseEnvelope(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    throw new ApiError({
      code: "BAD_RESPONSE",
      message: `Unexpected response from server (HTTP ${res.status})`,
      status: res.status,
    });
  }
  if (!res.ok || body.success === false) {
    throw new ApiError({
      code: body.code || `HTTP_${res.status}`,
      message: body.message || `Request failed (HTTP ${res.status})`,
      status: res.status,
      errors: body.errors || [],
      requestId: body.requestId || null,
    });
  }
  return body.data;
}

async function liveFetch(path, body, { auth = true, idempotencyKey = null } = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Request-Id": newRequestId(),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = "Bearer " + token;
  }
  const res = await fetch(API_BASE_URL + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // Expired access token → one single-flight refresh, then retry once.
  if (res.status === 401 && auth && getRefreshToken()) {
    await refreshSession();
    const retryHeaders = { ...headers, Authorization: "Bearer " + getAccessToken() };
    const retry = await fetch(API_BASE_URL + path, {
      method: "POST",
      headers: retryHeaders,
      body: JSON.stringify(body),
    });
    return parseEnvelope(retry);
  }
  return parseEnvelope(res);
}

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const data = await liveFetch(
          "/api/v1/auth/session",
          { action: "REFRESH_TOKEN", payload: { refreshToken: getRefreshToken() } },
          { auth: false }
        );
        storeAuth(data);
        return data;
      } catch (err) {
        // Rotation reuse detection / expiry → the whole session is dead.
        clearSession();
        notifySessionExpired();
        throw err;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

// ── session-expiry notification (Shell subscribes) ──────────
const expiryListeners = new Set();
export function onSessionExpired(cb) {
  expiryListeners.add(cb);
  return () => expiryListeners.delete(cb);
}
function notifySessionExpired() {
  expiryListeners.forEach((cb) => {
    try { cb(); } catch {}
  });
}

// ── unified dispatch ────────────────────────────────────────
async function dispatch(channel, body, opts = {}) {
  if (IS_MOCK) {
    const m = await mock();
    return m.mockDispatch(channel, body, {
      accessToken: getAccessToken(),
      idempotencyKey: opts.idempotencyKey || null,
    });
  }
  const paths = {
    session: "/api/v1/auth/session",
    query: "/api/v1/lms/query",
    command: "/api/v1/lms/command",
    media: "/api/v1/media/command",
    tracking: "/api/v1/tracking/event",
    public: "/api/v1/public/query",
  };
  return liveFetch(paths[channel], body, {
    auth: channel !== "public",
    idempotencyKey: opts.idempotencyKey,
  });
}

// ── public facade ───────────────────────────────────────────

/** Auth endpoint. action: LOGIN_PASSWORD | LOGIN_GOOGLE | REFRESH_TOKEN | LOGOUT | ME */
export async function sessionAction(action, payload = null) {
  return dispatch("session", { action, payload });
}

export async function loginPassword(email, password) {
  const data = await sessionAction("LOGIN_PASSWORD", { email, password });
  storeAuth(data);
  return data;
}

export async function loginGoogle(idToken) {
  const data = await sessionAction("LOGIN_GOOGLE", { idToken });
  storeAuth(data);
  return data;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await sessionAction("LOGOUT", { refreshToken });
  } catch {
    // best-effort — clear locally regardless
  }
  clearSession();
}

/** Fresh ME from the server; also refreshes the cached user. */
export async function me() {
  const data = await sessionAction("ME");
  if (data?.user) storage()?.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

/** Read. name: MY_COURSES, COURSE_DETAIL, … filters/pagination/sort optional. */
export async function query(name, { filters = null, pagination = null, sort = null } = {}) {
  return dispatch("query", { query: name, filters, pagination, sort });
}

/**
 * Business write. Commands that require an Idempotency-Key
 * (ENROLL_STUDENT, BULK_ENROLL_STUDENTS, SUBMIT_QUIZ_ATTEMPT, GENERATE_CERTIFICATE)
 * get one automatically unless provided.
 */
const IDEMPOTENT_COMMANDS = new Set([
  "ENROLL_STUDENT", "BULK_ENROLL_STUDENTS", "SUBMIT_QUIZ_ATTEMPT", "GENERATE_CERTIFICATE",
]);

export async function command(name, payload = null, { idempotencyKey = null, reason = null } = {}) {
  const key = idempotencyKey || (IDEMPOTENT_COMMANDS.has(name) ? newIdempotencyKey() : null);
  const body = { command: name, payload };
  if (reason) body.metadata = { clientRequestId: newRequestId(), reason };
  return dispatch("command", body, { idempotencyKey: key });
}

const IDEMPOTENT_MEDIA = new Set(["CREATE_VIDEO_UPLOAD_URL", "COMPLETE_VIDEO_UPLOAD"]);

export async function mediaCommand(name, payload = null, { idempotencyKey = null } = {}) {
  const key = idempotencyKey || (IDEMPOTENT_MEDIA.has(name) ? newIdempotencyKey() : null);
  return dispatch("media", { command: name, payload }, { idempotencyKey: key });
}

/** Tracking. event: VIDEO_HEARTBEAT | VIDEO_COMPLETED | MARK_LESSON_COMPLETE */
export async function trackingEvent(event, payload) {
  return dispatch("tracking", { event, payload });
}

/** Unauthenticated. query: VERIFY_CERTIFICATE */
export async function publicQuery(name, filters = null) {
  return dispatch("public", { query: name, filters });
}

/** Absolute URL of the certificate PDF (live). In mock mode the printable page is used instead. */
export function certificateDownloadUrl(codeOrPath) {
  if (IS_MOCK) return null;
  const path = codeOrPath.startsWith("/")
    ? codeOrPath
    : "/api/v1/certificates/download/" + codeOrPath;
  return API_BASE_URL + path;
}

/**
 * Uploads a file to a presigned URL with progress callbacks.
 * live: real HTTP PUT to S3. mock: simulated progress + blob registration
 * so the video plays back in this browser session.
 */
export function uploadFile(uploadUrl, file, contentType, onProgress) {
  if (IS_MOCK) {
    return mock().then((m) => m.mockUpload(uploadUrl, file, onProgress));
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError({ code: "UPLOAD_FAILED", message: `Upload failed (HTTP ${xhr.status})`, status: xhr.status }));
    };
    xhr.onerror = () =>
      reject(new ApiError({ code: "UPLOAD_FAILED", message: "Upload failed — network error or S3 CORS not configured", status: 0 }));
    xhr.send(file);
  });
}

/** Reads a video file's duration (seconds) in the browser; 0 if unreadable. */
export function probeVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        const d = Math.round(v.duration || 0);
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(d) ? d : 0);
      };
      v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      v.src = url;
    } catch {
      resolve(0);
    }
  });
}
