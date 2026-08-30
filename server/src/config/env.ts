import "dotenv/config";

// ---------------------------------------------------------------------------
// Environment.
//
// Validated once, at boot, and then trusted everywhere. A missing DATABASE_URL
// should stop the process on line one with a sentence that says so — not
// surface twenty minutes later as a connection error inside a request handler.
//
// SESSION_SECRET is checked hardest: a server that silently falls back to a
// default signing key issues session cookies that anyone who has read this
// repository can forge.
// ---------------------------------------------------------------------------

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const sessionSecret = required("SESSION_SECRET");

// The placeholder in .env.example is fine for local work and must never reach
// a deployed environment.
if (isProduction && sessionSecret.startsWith("dev-only")) {
  throw new Error(
    "SESSION_SECRET is still the development placeholder. Generate a real one: " +
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  );
}

export const env = {
  nodeEnv,
  isProduction,
  port: int("PORT", 4000),
  clientUrl: process.env.CLIENT_URL?.trim() || "http://localhost:3000",
  databaseUrl: required("DATABASE_URL"),

  sessionSecret,
  /** How long a signed-in session lasts before it must be renewed. */
  sessionDays: int("SESSION_DAYS", 7),

  /**
   * Which messaging adapter to use. `noop` logs instead of sending, so the
   * whole application works end to end before any provider contract exists.
   */
  messageProvider: process.env.MESSAGE_PROVIDER?.trim() || "noop",
} as const;
