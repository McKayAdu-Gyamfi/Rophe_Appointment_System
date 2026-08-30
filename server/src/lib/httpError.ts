// ---------------------------------------------------------------------------
// Errors, as one shape.
//
// Every failure the API returns looks like this:
//
//     { "error": { "code": "NOT_FOUND", "message": "…", "details"?: … } }
//
// and every success is the bare payload. The frontend's lib/api.ts can then
// have exactly one place that decides "did this work?", instead of one per
// endpoint. Two people building two halves of an API is precisely the
// situation where that convention has to be written down rather than assumed.
//
// Throw these from anywhere — controllers, services, middleware. The central
// handler turns them into responses; anything else that escapes becomes a 500
// with its detail logged and withheld from the client.
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "GONE"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
};

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

/**
 * Shorthands. `message` is read by a human — a member of front-desk staff, via
 * the UI — so write it as a sentence, not as a log line.
 */
export const badRequest = (m: string, d?: unknown) => new HttpError("BAD_REQUEST", m, d);
export const unauthenticated = (m = "Sign in to continue.") => new HttpError("UNAUTHENTICATED", m);
export const forbidden = (m = "You don't have access to that.") => new HttpError("FORBIDDEN", m);
export const notFound = (m: string) => new HttpError("NOT_FOUND", m);
export const conflict = (m: string, d?: unknown) => new HttpError("CONFLICT", m, d);
export const gone = (m: string) => new HttpError("GONE", m);
