/**
 * Error thrown by both the live API client and the mock server.
 * Mirrors the backend envelope: {success:false, code, message, errors[], requestId}
 * plus the HTTP status it arrived with.
 */
export class ApiError extends Error {
  constructor({ code = "UNKNOWN", message = "Request failed", status = 0, errors = [], requestId = null }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.errors = errors;
    this.requestId = requestId;
  }

  get isAuthError() {
    return this.status === 401 || this.code === "UNAUTHORIZED";
  }

  get isRateLimit() {
    return this.status === 429 || this.code === "RATE_LIMIT_EXCEEDED";
  }
}

/** Human-readable message including field errors, safe to render in a notice. */
export function errorText(err) {
  if (!err) return "Something went wrong.";
  if (err instanceof ApiError) {
    const fields = (err.errors || [])
      .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
      .join("; ");
    return fields ? `${err.message} — ${fields}` : err.message;
  }
  if (err.message === "Failed to fetch" || err.name === "TypeError") {
    return "Cannot reach the LMS backend. Is it running and is CORS configured for this origin?";
  }
  return err.message || String(err);
}
