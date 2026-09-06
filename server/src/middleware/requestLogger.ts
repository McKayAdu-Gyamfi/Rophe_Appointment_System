import type { RequestHandler } from "express";

// One line per request: method, path, status, duration. Deliberately minimal —
// swap for pino when there is somewhere to ship logs to.
//
// Query strings are NOT logged, and neither are the path segments that carry a
// credential. A patient's portal link and a staff invitation both put a secret
// in the URL, and a token in a log file is a credential in a log file — the
// same reasoning that keeps them out of the database in plaintext.

/**
 * Replace credential-bearing path segments with their parameter name.
 *
 *   /api/portal/AbC123.../requests            → /api/portal/:token/requests
 *   /api/staff/invitations/AbC123.../accept   → /api/staff/invitations/:token/accept
 *
 * The invitation routes are redacted whether the segment is a token or a record
 * id: telling them apart from here is guesswork, and losing an id from a log
 * line costs less than printing one live invite link.
 */
export function redactPath(path: string): string {
  return path
    .replace(/^(\/api\/portal)\/[^/]+/, "$1/:token")
    .replace(/^(\/api\/staff\/invitations)\/[^/]+/, "$1/:token");
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    const line = `${req.method} ${redactPath(req.originalUrl.split("?")[0])} ${res.statusCode} ${ms}ms`;
    if (res.statusCode >= 500) console.error(line);
    else console.log(line);
  });
  next();
};
