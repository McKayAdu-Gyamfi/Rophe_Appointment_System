import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodType, z } from "zod";

// ---------------------------------------------------------------------------
// Validation, and the async wrapper that makes throwing safe.
//
// The rule for this codebase: a controller never reads `req.body` directly. It
// reads the parsed, typed result of a schema. That is what stops the two
// halves of this API drifting into two different ideas of what a request is,
// and it is why the existing starter controllers — which destructured straight
// into Prisma — are being replaced rather than extended.
// ---------------------------------------------------------------------------

/**
 * Express 4 does not catch rejected promises, so an `async` handler that throws
 * hangs the request instead of reaching the error handler. Every async route
 * goes through this.
 *
 *     router.get("/", asyncHandler(listPatients));
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/**
 * Validate the body and replace it with the parsed value, so downstream code
 * gets the coerced, defaulted, typed object rather than raw JSON.
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

/**
 * Same for query strings. Note query values are always strings, so schemas here
 * need `z.coerce` for numbers and dates.
 */
export function validateQuery(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    // req.query is a getter in Express 5; assign through a cast rather than
    // mutating it, and read the parsed copy from res.locals.
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };
}

/** Read what validateQuery parsed. */
export function query<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}

// --- Shared field schemas --------------------------------------------------
//
// Anything both halves of the API need to agree on lives here, so "what counts
// as a valid phone number" is answered once.

/** cuid, as Prisma generates. */
export const idSchema = z.string().min(1, "Missing id.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

/**
 * Ghanaian numbers arrive as "+233 24 123 4567", "024 123 4567" or
 * "0241234567". Store what was typed — front desk recognises their own
 * formatting — but require enough digits to be dialable.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .refine((v) => v.replace(/\D/g, "").length >= 9, "That phone number looks too short.");

/** "HH:mm", 24-hour. Used by availability windows. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 09:00.");

/** "YYYY-MM-DD" — the shape the frontend sends for a calendar day. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-03-09.");

export const channelSchema = z.enum(["WHATSAPP", "SMS", "EMAIL"]);
