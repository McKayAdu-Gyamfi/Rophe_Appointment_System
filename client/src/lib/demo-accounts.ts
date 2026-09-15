import type { StaffRole } from "@/lib/types";

// Mirrors the active staff in server/prisma/seed.ts. The login page can't ask
// the API for these: listing staff needs a session. Keep the two in step.
export const DEMO_PASSWORD = "rophe123";

export const DEMO_ACCOUNTS: { email: string; fullName: string; role: StaffRole }[] = [
  { email: "frontdesk@rophe.care", fullName: "Abena Owusu", role: "front-desk" },
  { email: "reception@rophe.care", fullName: "Kofi Boateng", role: "front-desk" },
  { email: "dr.mensah@rophe.care", fullName: "Dr. Akosua Mensah", role: "doctor" },
];

/**
 * On in development. A deployed build shows them only when
 * NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS is "true", and any environment can hide them
 * with "false" — a real clinic database never has these accounts.
 */
export const SHOW_DEMO_ACCOUNTS =
  process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === undefined
    ? process.env.NODE_ENV !== "production"
    : process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";
