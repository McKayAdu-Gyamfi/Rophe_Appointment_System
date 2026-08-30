import type { RequestHandler } from "express";

// One line per request: method, path, status, duration. Deliberately minimal —
// swap for pino when there is somewhere to ship logs to.
//
// Query strings are NOT logged. Patient portal links carry an access token, and
// a token in a log file is a credential in a log file.
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    const line = `${req.method} ${req.path} ${res.statusCode} ${ms}ms`;
    if (res.statusCode >= 500) console.error(line);
    else console.log(line);
  });
  next();
};
