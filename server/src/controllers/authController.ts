import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { verifyPassword } from "../lib/crypto";
import { unauthenticated } from "../lib/httpError";
import { emailSchema } from "../middleware/validate";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
} from "../services/sessionService";
import { toStaffSession } from "../mappers/staffMapper";

// ---------------------------------------------------------------------------
// Sign in, sign out, who am I.
//
// Replaces the prototype's browser-side credential check (client/src/lib/api.ts
// `signIn`), which compared plaintext against seeded data and kept the result
// in localStorage. Same three functions, same response shape — the frontend
// swap is a fetch call, not a rewrite.
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(req: Request, res: Response) {
  const { email, password } = req.body as z.infer<typeof signInSchema>;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { doctor: true },
  });

  // An account that exists but was never activated has no password to be
  // wrong, and "those credentials don't match" would send a new joiner hunting
  // for one nobody ever gave them. Naming the real cause costs nothing — they
  // were sent the invitation. This is the ONLY case where the message differs.
  if (user && user.status === "INVITED") {
    throw unauthenticated(
      "This account hasn't been set up yet. Open the invitation link to choose a password.",
    );
  }

  if (user && user.status === "DISABLED") {
    throw unauthenticated("This account has been switched off. Speak to the front desk.");
  }

  const valid =
    user?.passwordHash != null && (await verifyPassword(user.passwordHash, password));

  // Otherwise: identical response whether the email is unknown or the password
  // is wrong, so the endpoint cannot be used to enumerate who works here.
  if (!user || !valid) {
    throw unauthenticated("Those credentials don't match an account.");
  }

  await createSession(res, {
    userId: user.id,
    userAgent: req.get("user-agent") ?? undefined,
    ipAddress: req.ip,
  });

  res.json({ session: toStaffSession(user) });
}

export async function signOut(req: Request, res: Response) {
  await destroySession(res, req.cookies?.[SESSION_COOKIE]);
  res.status(204).end();
}

/**
 * The session the cookie resolves to. The frontend calls this on boot instead
 * of reading localStorage, so a revoked or expired session is noticed at the
 * door rather than on the first write.
 */
export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { doctor: true },
  });
  if (!user) throw unauthenticated();
  res.json({ session: toStaffSession(user) });
}
