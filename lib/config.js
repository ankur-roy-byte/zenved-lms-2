// ─────────────────────────────────────────────────────────────
// Runtime configuration — decides whether the app talks to the
// real LMS backend ("live") or the in-browser demo data ("mock").
//
//   NEXT_PUBLIC_API_MODE      "mock" | "live"   explicit override
//   NEXT_PUBLIC_API_BASE_URL  backend origin, e.g. http://localhost:8080
//   NEXT_PUBLIC_ALLOW_MOCK    "true" to permit mock in a production build
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID  Google OAuth client id (live mode)
//
// Defaults: development → mock (runs with seeded demo data, no
// backend needed); production build → live. Mock mode is NOT
// available in production unless NEXT_PUBLIC_ALLOW_MOCK=true is
// set explicitly at build time — demo data never leaks into a
// real deployment by accident.
// ─────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";
const EXPLICIT_MODE = process.env.NEXT_PUBLIC_API_MODE;
const ALLOW_MOCK_IN_PROD = process.env.NEXT_PUBLIC_ALLOW_MOCK === "true";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function resolveMode() {
  if (EXPLICIT_MODE === "live") return "live";
  if (EXPLICIT_MODE === "mock") {
    if (IS_PROD && !ALLOW_MOCK_IN_PROD) return "live"; // hard gate
    return "mock";
  }
  // No explicit mode: dev runs on demo data, prod talks to the backend.
  return IS_PROD ? "live" : "mock";
}

export const API_MODE = resolveMode();
export const IS_MOCK = API_MODE === "mock";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/** Where certificate QR codes / verify links point (shown on /verify). */
export const APP_NAME = "ZenVed LMS";
