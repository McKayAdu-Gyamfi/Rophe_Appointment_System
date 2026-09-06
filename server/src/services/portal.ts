import { prisma } from "../lib/prisma";
import { generateToken, hashToken } from "../lib/crypto";
import { gone, notFound } from "../lib/httpError";
import { env } from "../config/env";

// ---------------------------------------------------------------------------
// The patient's link to their own appointment.
//
// Patients never have an account, so this token *is* the credential — whoever
// holds the link is treated as the patient. That makes it exactly as sensitive
// as a password, and it gets the same handling: 32 bytes from the CSPRNG,
// stored only as a SHA-256 digest, and expiring on its own.
//
// It replaces putting the appointment's row id in the URL, which made every
// patient's name, phone and appointment readable to anyone who could guess a
// cuid or find one in a browser history, a shared phone, or a forwarded chat.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Issue a fresh link for an appointment.
 *
 * Earlier tokens for the same appointment are left alone rather than revoked:
 * a patient who still has last week's reminder open should not find it dead
 * because a new one went out this morning. They expire on their own.
 */
export async function issuePortalToken(appointmentId: string): Promise<string> {
  const settings = await prisma.clinicSettings.findUnique({ where: { id: "clinic" } });
  const days = settings?.portalTokenDays ?? 30;

  const token = generateToken();
  await prisma.portalAccessToken.create({
    data: {
      tokenHash: hashToken(token),
      appointmentId,
      expiresAt: new Date(Date.now() + days * DAY_MS),
    },
  });

  return token;
}

/** The full URL that goes in a message. */
export function portalUrl(token: string): string {
  return `${env.clientUrl.replace(/\/$/, "")}/portal/appointment/${token}`;
}

/**
 * Kill every live link for an appointment.
 *
 * Called when an appointment is cancelled: the link is a credential for a
 * visit that is no longer happening, and leaving it live means a patient can
 * still open — and confirm — something the clinic has called off.
 */
export async function revokePortalTokens(appointmentId: string): Promise<void> {
  await prisma.portalAccessToken.updateMany({
    where: { appointmentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Resolve a link to its appointment, or say why not.
 *
 * Expired and revoked are 410 rather than 404 on purpose: the patient is
 * holding a link that genuinely was theirs, and "ask the clinic for a new one"
 * is actionable where "not found" reads as a broken website.
 */
export async function resolvePortalToken(token: string) {
  const record = await prisma.portalAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      appointment: {
        include: {
          type: true,
          patient: true,
          doctor: { include: { user: true } },
        },
      },
    },
  });

  if (!record) throw notFound("That link is not valid. Ask the clinic for a new one.");

  if (record.revokedAt) {
    throw gone("That link has been cancelled. Ask the clinic for a new one.");
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw gone("That link has expired. Ask the clinic for a new one.");
  }

  // Cheap last-seen tracking; a failure here must not fail the request.
  void prisma.portalAccessToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return record;
}
