import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// The one place a failure becomes a response.
//
// Controllers throw; this decides the status and the wording. Three sources of
// error get translated rather than leaking:
//
//   * ZodError            → 422 with per-field messages the UI can show
//   * Prisma known errors → the HTTP status the constraint actually means
//   * everything else     → 500, logged in full, described in one word
//
// That last one is the important one. A raw Prisma error carries table names,
// column names and sometimes row values; returning it to the browser hands an
// attacker a schema diagram, and hands a member of staff something they cannot
// act on. It goes to the log, not the client.
// ---------------------------------------------------------------------------

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No route matches ${req.method} ${req.path}.`,
    },
  });
}

/** Field-level messages, keyed by dotted path, for a form to render inline. */
function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!details[path]) details[path] = issue.message;
  }
  return details;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Required for Express to recognise this as an error handler, even unused.
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_FAILED",
        message: "Some of those details need correcting.",
        details: zodDetails(err),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique violation, P2025 record not found, P2003 FK violation.
    if (err.code === "P2002") {
      return res.status(409).json({
        error: { code: "CONFLICT", message: "That already exists." },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "That record no longer exists." },
      });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Something else still refers to that record.",
        },
      });
    }
  }

  console.error("[unhandled]", err);
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "Something went wrong on our end.",
      // Never in production: the stack names files and sometimes values.
      details: env.isProduction ? undefined : String(err),
    },
  });
}
