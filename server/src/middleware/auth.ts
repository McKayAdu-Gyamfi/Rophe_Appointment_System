import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "@prisma/client";
import { forbidden, unauthenticated } from "../lib/httpError";
import { SESSION_COOKIE, resolveSession } from "../services/sessionService";

// ---------------------------------------------------------------------------
// Who is asking, and may they.
//
// This is the contract both halves of the API build against, so it is worth
// stating plainly:
//
//     router.get("/",       requireAuth,            asyncHandler(list));
//     router.post("/",      requireFrontDesk,       asyncHandler(create));
//     router.get("/mine",   requireDoctor,          asyncHandler(mySchedule));
//
// After `requireAuth`, `req.auth` is always present and always ACTIVE — no
// handler needs to null-check it. `req.auth.doctorId` is set only on doctor
// accounts, and it is what the doctor-facing screens must scope to. The
// frontend currently hardcodes "doc-1" on three screens, which means an
// invited doctor sees somebody else's diary; the fix is to read this, never a
// doctorId from the client.
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  /** Present only when role is DOCTOR. */
  doctorId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Attach `req.auth` if the caller has a valid session; otherwise leave it unset
 * and continue. For routes that behave differently when signed in but do not
 * demand it.
 */
export const attachAuth: RequestHandler = async (req, _res, next) => {
  try {
    const session = await resolveSession(req.cookies?.[SESSION_COOKIE]);
    if (session) {
      req.auth = {
        userId: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role,
        doctorId: session.user.doctor?.id,
      };
    }
    next();
  } catch (err) {
    next(err);
  }
};

/** Demand a signed-in, active account. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  if (req.auth) return next();
  await attachAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.auth) return next(unauthenticated());
    next();
  });
};

/**
 * Demand one of these roles. ADMIN passes anything a front-desk account can do
 * — there is no action an administrator should be locked out of while being
 * responsible for the system.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      const role = req.auth!.role;
      if (role === "ADMIN" || roles.includes(role)) return next();
      next(forbidden("That action is for other staff."));
    });
  };
}

/** Booking, patients, messaging, staff administration. */
export const requireFrontDesk = requireRole("FRONT_DESK");

/** A doctor's own schedule and availability. */
export const requireDoctor = requireRole("DOCTOR");

/**
 * The doctor whose data is being touched.
 *
 * A doctor may only ever act on their own record; front desk and admin may act
 * on any, but must say which. Centralised because getting it wrong means one
 * clinician editing another's availability — exactly the bug the prototype
 * shipped with.
 */
export function resolveDoctorId(req: Request, requested?: string): string {
  const auth = req.auth!;

  if (auth.role === "DOCTOR") {
    if (!auth.doctorId) {
      throw forbidden("This account is not linked to a doctor record.");
    }
    if (requested && requested !== auth.doctorId) {
      throw forbidden("You can only view or change your own schedule.");
    }
    return auth.doctorId;
  }

  if (!requested) {
    throw forbidden("Specify which doctor this applies to.");
  }
  return requested;
}
