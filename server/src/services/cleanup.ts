import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Housekeeping.
//
// Sessions and portal links are already refused once they expire, so this is
// not a correctness fix — it is about not keeping credentials, even hashed
// ones, after they have stopped meaning anything. A table of dead sessions is
// a list of who signed in and when, kept indefinitely, for no reason anyone
// would give if asked.
//
// Runs in-process on an interval rather than as a cron job, because the clinic
// deploys one API and a second moving part is a second thing to forget. If
// this ever runs on several instances they will simply race to delete the same
// rows, which is harmless.
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

export async function purgeExpired(): Promise<{ sessions: number; portalTokens: number }> {
  const now = new Date();

  const [sessions, portalTokens] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.portalAccessToken.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);

  return { sessions: sessions.count, portalTokens: portalTokens.count };
}

export function startCleanup(intervalMs = HOUR_MS): void {
  const run = () => {
    void purgeExpired()
      .then(({ sessions, portalTokens }) => {
        if (sessions || portalTokens) {
          console.log(`[cleanup] removed ${sessions} expired sessions, ${portalTokens} portal links`);
        }
      })
      .catch((error) => console.error("[cleanup] sweep failed", error));
  };

  run();
  // unref so a pending sweep never keeps the process alive during a shutdown.
  setInterval(run, intervalMs).unref();
}
