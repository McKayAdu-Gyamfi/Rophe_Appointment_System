import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { generateToken, hashToken } from "../lib/crypto";

// ---------------------------------------------------------------------------
// Sessions.
//
// Server-side rows, not stateless tokens. A clinic needs to be able to end a
// session it no longer trusts — a lost phone, a member of staff who left this
// morning — and a self-contained JWT cannot be withdrawn before it expires.
// The cost is one indexed lookup per request, which is the right trade here.
//
// The cookie is httpOnly (so page scripts cannot read it), sameSite=lax (so it
// is not sent on cross-site posts), and secure in production. The value in it
// is the token; what the database holds is only the hash.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "rophe_session";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

/** Issue a session and set the cookie. Returns nothing secret to the caller. */
export async function createSession(
  res: Response,
  { userId, userAgent, ipAddress }: CreateSessionInput,
): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env.sessionDays * DAY_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 255),
      ipAddress,
    },
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    expires: expiresAt,
    path: "/",
  });
}

/**
 * Resolve a cookie value to its user, or null.
 *
 * Expired rows are deleted on the way past rather than merely ignored — it
 * keeps the table from growing without a scheduled job, and it means a
 * compromised expired token cannot be revived by moving the clock.
 */
export async function resolveSession(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { doctor: true } } },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // A disabled account keeps its rows for the audit trail but must stop being
  // able to act, without waiting for the session to lapse.
  if (session.user.status !== "ACTIVE") return null;

  // Cheap last-seen tracking; failure here must not fail the request.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return session;
}

/** Sign out this session only — other devices stay signed in. */
export async function destroySession(res: Response, token: string | undefined): Promise<void> {
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Sign out everywhere. Used when a password changes or an account is disabled. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
