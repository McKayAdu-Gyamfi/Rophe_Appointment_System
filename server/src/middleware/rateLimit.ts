import type { Request, RequestHandler } from "express";
import { HttpError } from "../lib/httpError";

// ---------------------------------------------------------------------------
// Rate limiting for the endpoints anyone can reach.
//
// A fixed window counted in memory. That is a deliberate floor, not a ceiling:
// it stops a script walking the portal-token space or grinding at the login
// form from one address, and it costs no infrastructure. Two things it is not:
//
//   It is per-process. Two API instances mean two independent budgets, so the
//   effective limit is the configured one times the instance count. Moving the
//   counter to Redis is the fix when the clinic runs more than one.
//
//   It is per-IP, so it does not distinguish users behind one NAT. The limits
//   below are set high enough that a clinic sharing an office connection is
//   nowhere near them, and low enough to make guessing pointless.
// ---------------------------------------------------------------------------

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Requests allowed per window, per key. */
  max: number;
  windowMs: number;
  /** Shown to whoever hit it — a human, so write a sentence. */
  message?: string;
}

/** Behind a proxy Express reports the forwarded address once trust proxy is set. */
function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function rateLimit({ max, windowMs, message }: RateLimitOptions): RequestHandler {
  const windows = new Map<string, Window>();

  // Sweep on write rather than on a timer: the map only grows when requests
  // arrive, so that is the only time it needs clearing, and it keeps the
  // process free of a handle that would hold it open.
  function sweep(now: number) {
    if (windows.size < 1000) return;
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req);
    const window = windows.get(key);

    if (!window || window.resetAt <= now) {
      sweep(now);
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    window.count += 1;

    if (window.count > max) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return next(
        new HttpError(
          "TOO_MANY_REQUESTS",
          message ?? "Too many attempts. Wait a moment and try again.",
        ),
      );
    }

    next();
  };
}
