import type { Doctor, Role, User, UserStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Database row → API shape.
//
// Mappers exist so the wire format is a decision, not an accident. Two reasons
// they are not optional here:
//
//   1. `User` carries passwordHash and inviteTokenHash. Returning a Prisma row
//      directly leaks both. Building the response field by field means a new
//      column is invisible to the API until somebody adds it on purpose —
//      which is the right default for a table holding credentials.
//   2. The frontend already has these types (client/src/lib/types.ts) and
//      hundreds of lines reading them. Matching that shape exactly is what
//      makes the Phase 3 swap a change to lib/api.ts alone.
//
// Prisma enums are SCREAMING_CASE; the frontend's are kebab/lower. Convert
// here, once, rather than in every screen.
// ---------------------------------------------------------------------------

/** Mirrors `StaffRole` in client/src/lib/types.ts. */
export type ApiStaffRole = "front-desk" | "doctor";

/** Mirrors `StaffStatus`. */
export type ApiStaffStatus = "invited" | "active" | "disabled";

/** Mirrors `StaffSession` — note neither secret appears. */
export interface ApiStaffSession {
  id: string;
  fullName: string;
  email: string;
  role: ApiStaffRole;
  staffId: string;
  jobTitle: string;
  doctorId?: string;
  status: ApiStaffStatus;
  invitedAt?: string;
  invitedBy?: string;
  activatedAt?: string;
}

/**
 * ADMIN presents as front-desk to the UI. The prototype's navigation and
 * screens are built around two roles; an administrator can do everything front
 * desk can, so this keeps the interface honest without inventing a third set of
 * screens nobody has designed yet.
 */
export function toApiRole(role: Role): ApiStaffRole {
  return role === "DOCTOR" ? "doctor" : "front-desk";
}

export function toApiStatus(status: UserStatus): ApiStaffStatus {
  return status.toLowerCase() as ApiStaffStatus;
}

type UserWithDoctor = User & {
  doctor?: Doctor | null;
  invitedBy?: { fullName: string } | null;
};

export function toStaffSession(user: UserWithDoctor): ApiStaffSession {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: toApiRole(user.role),
    staffId: user.staffId,
    jobTitle: user.jobTitle,
    doctorId: user.doctor?.id,
    status: toApiStatus(user.status),
    invitedAt: user.invitedAt?.toISOString(),
    invitedBy: user.invitedBy?.fullName ?? undefined,
    activatedAt: user.activatedAt?.toISOString(),
  };
}
