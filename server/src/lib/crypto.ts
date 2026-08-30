import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

// ---------------------------------------------------------------------------
// Secrets: how they are made, stored and compared.
//
// Two different jobs here, deliberately using two different primitives:
//
//   Passwords are chosen by people, so they are low-entropy and guessable at
//   scale. They get Argon2id — slow and memory-hard on purpose, so that
//   somebody who steals the table cannot test billions of candidates.
//
//   Tokens (session, invite, portal link) are generated here from 32 bytes of
//   CSPRNG output. They are already unguessable, so the only job is to make a
//   stolen database useless — SHA-256 does that, and a slow hash on every
//   request would just be a self-inflicted rate limit.
//
// The rule that matters more than either choice: none of these three values is
// ever stored in plaintext, and none is ever logged.
// ---------------------------------------------------------------------------

/** OWASP's current baseline for Argon2id. */
const ARGON_OPTIONS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON_OPTIONS);
}

/**
 * Verify a password. Returns false rather than throwing on a malformed hash,
 * so a corrupt row denies access instead of 500-ing the sign-in endpoint.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * A fresh, URL-safe secret for a link or a cookie. 32 bytes base64url — far
 * beyond guessing, and it survives being pasted into WhatsApp without
 * escaping.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** How a token is stored. Never keep the token itself. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compare two hex digests without leaking, through timing, how much of the
 * value matched. Prisma lookups are by indexed hash so this is belt-and-braces,
 * but it costs nothing and the habit is the point.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
