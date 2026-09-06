import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateToken, hashPassword, hashToken } from "../lib/crypto";
import { HttpError, conflict, forbidden, gone, notFound } from "../lib/httpError";
import { emailSchema } from "../middleware/validate";
import { destroyAllSessions } from "../services/sessionService";
import { toDbRole, toStaffSession } from "../mappers/staffMapper";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Staff accounts and the invitation lifecycle.
//
// The rule this file exists to enforce: front desk creates the account, the
// joiner creates the credentials. No endpoint here sets another user's
// password. `accept` is the only path that writes passwordHash at all, and it
// authenticates with the invite token rather than a session — the person using
// it does not have an account to sign in with yet, which is the whole point.
//
// The token is a credential, so it follows the same rule as a password: it is
// generated here, returned exactly once to the inviter, and stored only as a
// SHA-256 digest. A stolen database yields no working invite links.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** What every response here returns — never a raw User row. */
const staffInclude = {
  doctor: true,
  invitedBy: { select: { fullName: true } },
} as const;

/**
 * Next free "RSC-0000" badge number.
 *
 * Derived rather than stored because the clinic reads these off a lanyard and
 * expects them to run in sequence. Two invitations created in the same instant
 * can still collide on the unique index, so `invite` retries — cheaper than
 * serialising every insert behind a lock for something that happens a few
 * times a year.
 */
async function nextStaffId(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { staffId: { startsWith: "RSC-" } },
    select: { staffId: true },
  });

  const highest = users.reduce((max, { staffId }) => {
    const n = Number.parseInt(staffId.slice(4), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return `RSC-${String(highest + 1).padStart(4, "0")}`;
}

/** Resolve an invite token to the account it belongs to, or explain why not. */
async function findByInviteToken(token: string) {
  const user = await prisma.user.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: staffInclude,
  });

  // An accepted invitation has its hash cleared, so reaching here at all means
  // the link is either unknown or was never valid.
  if (!user) throw notFound("That invitation link is not valid. Ask the front desk for a new one.");

  if (user.status !== "INVITED") {
    throw gone("That invitation has already been used. Sign in with your password instead.");
  }

  if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() <= Date.now()) {
    throw gone("That invitation link has expired. Ask the front desk to send a new one.");
  }

  return user;
}

/** Issue a fresh token and its stored form. The plaintext is returned once. */
function newInvite() {
  const token = generateToken();
  return {
    token,
    inviteTokenHash: hashToken(token),
    inviteExpiresAt: new Date(Date.now() + env.inviteDays * DAY_MS),
  };
}

// --- Endpoints -------------------------------------------------------------

export async function list(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    include: staffInclude,
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
  });

  res.json(users.map(toStaffSession));
}

export const inviteSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter their full name."),
    email: emailSchema,
    role: z.enum(["front-desk", "doctor"]),
    jobTitle: z.string().trim().min(1, "Enter their job title."),
    specialty: z.string().trim().optional(),
  })
  // A doctor account without a specialty produces a Doctor row the booking
  // screens cannot label, so it is refused at the door rather than patched later.
  .refine((data) => data.role !== "doctor" || !!data.specialty, {
    message: "A doctor needs a specialty.",
    path: ["specialty"],
  });

export async function invite(req: Request, res: Response) {
  const input = req.body as z.infer<typeof inviteSchema>;

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict("Someone with that email address already has an account.");
  }

  // Retry only the staffId collision; anything else is a real failure.
  for (let attempt = 0; ; attempt++) {
    const { token, inviteTokenHash, inviteExpiresAt } = newInvite();

    try {
      const user = await prisma.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          staffId: await nextStaffId(),
          jobTitle: input.jobTitle,
          role: toDbRole(input.role),
          // No passwordHash. The column is nullable precisely so that this
          // state — a real account nobody can sign in to — is representable.
          status: "INVITED",
          inviteTokenHash,
          inviteExpiresAt,
          invitedAt: new Date(),
          invitedById: req.auth!.userId,
          ...(input.role === "doctor" && {
            doctor: { create: { specialty: input.specialty! } },
          }),
        },
        include: staffInclude,
      });

      // The only time the plaintext token leaves this server.
      res.status(201).json({ user: toStaffSession(user), inviteToken: token });
      return;
    } catch (error) {
      const clash =
        error instanceof Object &&
        "code" in error &&
        (error as { code?: string }).code === "P2002" &&
        attempt < 3;
      if (!clash) throw error;
    }
  }
}

/** Public — the joiner has no session yet. Shows them what they are accepting. */
export async function getInvitation(req: Request, res: Response) {
  const user = await findByInviteToken(req.params.token);
  res.json({ session: toStaffSession(user) });
}

export const acceptSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
});

/** Public, and the only endpoint in the API that writes a password hash. */
export async function accept(req: Request, res: Response) {
  const { password } = req.body as z.infer<typeof acceptSchema>;
  const user = await findByInviteToken(req.params.token);

  // Their own email address is the first thing anyone would try.
  if (password.trim().toLowerCase() === user.email.toLowerCase()) {
    throw new HttpError("VALIDATION_FAILED", "Choose something other than your email address.", {
      password: "Choose something other than your email address.",
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      activatedAt: new Date(),
      // Clearing the hash is what stops the link being replayed.
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
    include: staffInclude,
  });

  // Nothing should hold a session for an account that had no password until
  // this moment. If anything does, it predates the credential and is void.
  await destroyAllSessions(user.id);

  // Deliberately not signing them in — the invite screen sends them to the
  // login form so the password they just chose is proved while they are still
  // at the desk.
  res.json({ session: toStaffSession(updated) });
}

export async function resend(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw notFound("That staff record could not be found.");

  if (user.status !== "INVITED") {
    throw conflict("That account is already active — there is no invitation to resend.");
  }

  const { token, inviteTokenHash, inviteExpiresAt } = newInvite();

  // Replaced, not added to: the previous link stops working immediately.
  await prisma.user.update({
    where: { id: user.id },
    data: { inviteTokenHash, inviteExpiresAt, invitedAt: new Date() },
  });

  res.json({ inviteToken: token });
}

export async function revoke(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw notFound("That staff record could not be found.");

  // Revoking an invitation deletes the account, so this guard is the only
  // thing standing between a mis-click and a working colleague's record —
  // along with every appointment and audit row that hangs off it.
  if (user.status !== "INVITED") {
    throw forbidden("That colleague's account is active. Revoking only ever cancels an unaccepted invitation.");
  }

  if (user.id === req.auth!.userId) {
    throw forbidden("You cannot revoke your own account.");
  }

  // Doctor.userId cascades, so the linked Doctor row goes with it.
  await prisma.user.delete({ where: { id: user.id } });

  res.status(204).end();
}
