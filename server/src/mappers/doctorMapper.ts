import type { Doctor, User } from "@prisma/client";

/**
 * Maps a Prisma Doctor (and its joined User) to the frontend Doctor shape.
 * This guarantees we never leak password hashes or other sensitive User fields.
 */
export function toFrontendDoctor(doctor: Doctor & { user: User }) {
  return {
    id: doctor.id,
    fullName: doctor.user.fullName,
    specialty: doctor.specialty,
    active: doctor.active,
  };
}
