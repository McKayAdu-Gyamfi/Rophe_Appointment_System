import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "../lib/httpError";
import {
  asyncHandler,
  dateOnlySchema,
  query,
  timeSchema,
  validateQuery,
} from "../middleware/validate";
import { appointmentStatusCodec } from "../mappers/enums";
import { toInstant } from "../mappers/datetime";
import { toWireAppointment } from "../mappers/recordMappers";
import {
  assertInsideAvailability,
  assertNoOverlap,
  isFirstVisit,
  requireTypeByName,
  resolveDuration,
  windowsForDate,
  type Tx,
} from "../services/scheduling";

// ---------------------------------------------------------------------------
// Appointments.
//
// Reads are scoped: a doctor sees their own diary and nobody else's, front
// desk sees the clinic's. Writes re-apply every rule the booking form applies
// in the browser, because the browser is not where correctness can live.
//
// Every write runs in a Serializable transaction. Two people booking the last
// 09:00 slot at the same moment both read "that slot is free" and both insert;
// under Serializable, Postgres refuses to pretend those happened in sequence
// and aborts one, which becomes the 409 the loser should have got.
// ---------------------------------------------------------------------------

/** The type relation the wire mapper needs on every appointment it returns. */
const withType = { type: true } as const;

/**
 * Whose diary a request may touch.
 *
 * A doctor is pinned to their own record whatever they ask for; front desk may
 * name anyone, or nobody for the whole clinic. Deliberately not resolveDoctorId
 * — that helper demands front desk name a doctor, and "every appointment today"
 * is the front desk's main screen.
 */
function scopeDoctorId(req: Request, requested?: string): string | undefined {
  const auth = req.auth!;
  if (auth.role !== "DOCTOR") return requested;

  if (!auth.doctorId) {
    throw forbidden("This account is not linked to a doctor record.");
  }
  if (requested && requested !== auth.doctorId) {
    throw forbidden("You can only see your own appointments.");
  }
  return auth.doctorId;
}

// --- Reads -----------------------------------------------------------------

const listQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  doctorId: z.string().optional(),
  patientId: z.string().optional(),
  status: z.enum(appointmentStatusCodec.wireValues).optional(),
});

export const list = [
  validateQuery(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = query<z.infer<typeof listQuerySchema>>(req);
    const doctorId = scopeDoctorId(req, filters.doctorId);

    // Half-open: `to` is inclusive of the whole day the caller named.
    const startsAt =
      filters.from || filters.to
        ? {
            ...(filters.from && { gte: toInstant(filters.from, "00:00") }),
            ...(filters.to && { lt: new Date(toInstant(filters.to, "00:00").getTime() + 86_400_000) }),
          }
        : undefined;

    const appointments = await prisma.appointment.findMany({
      where: {
        ...(doctorId && { doctorId }),
        ...(filters.patientId && { patientId: filters.patientId }),
        ...(filters.status && { status: appointmentStatusCodec.toDb(filters.status) }),
        ...(startsAt && { startsAt }),
      },
      include: withType,
      // Matches @@index([doctorId, startsAt]) and @@index([startsAt]).
      orderBy: { startsAt: "asc" },
    });

    res.json(appointments.map(toWireAppointment));
  }),
];

export async function get(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: withType,
  });
  if (!appointment) throw notFound("That appointment could not be found.");

  // Scope after the fetch so a doctor cannot use the 404 to learn whether an
  // id belongs to a colleague's patient.
  scopeDoctorId(req, appointment.doctorId);

  res.json(toWireAppointment(appointment));
}

// --- Writes ----------------------------------------------------------------

/**
 * Serializable, and 409 on the write conflict Postgres reports (P2034) rather
 * than the 500 an unhandled abort would produce. This is the concurrency
 * guarantee: the loser of a race is told the slot went, not that the server
 * broke.
 */
async function inBookingTransaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(run, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw conflict("Someone just booked that slot. Pick another time.");
    }
    throw error;
  }
}

export const bookSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentType: z.string().min(1),
  date: dateOnlySchema,
  time: timeSchema,
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function book(req: Request, res: Response) {
  const input = req.body as z.infer<typeof bookSchema>;
  const startsAt = toInstant(input.date, input.time);

  // A new appointment in the past is a typo. Rescheduling into the past is
  // not — see `update`, where front desk is recording what already happened.
  if (startsAt.getTime() < Date.now()) {
    throw badRequest("That date and time have already passed.");
  }

  const appointment = await inBookingTransaction(async (tx) => {
    const [patient, doctor, type, settings] = await Promise.all([
      tx.patient.findUnique({ where: { id: input.patientId } }),
      tx.doctor.findUnique({ where: { id: input.doctorId } }),
      requireTypeByName(tx, input.appointmentType),
      tx.clinicSettings.findUnique({ where: { id: "clinic" } }),
    ]);

    if (!patient) throw notFound("That patient could not be found.");
    if (!doctor) throw notFound("That doctor could not be found.");
    if (!doctor.active) throw conflict("That doctor is no longer taking bookings.");

    const durationMinutes = resolveDuration({
      requested: input.durationMinutes,
      firstVisit: await isFirstVisit(tx, patient.id),
      firstVisitMinutes: settings?.firstVisitMinutes ?? 40,
      typeMinutes: type.durationMinutes,
    });

    assertInsideAvailability(
      await windowsForDate(tx, doctor.id, startsAt),
      input.time,
      durationMinutes,
    );
    await assertNoOverlap(tx, doctor.id, startsAt, durationMinutes);

    return tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        typeId: type.id,
        startsAt,
        durationMinutes,
        notes: input.notes,
        status: "BOOKED",
      },
      include: withType,
    });
  });

  res.status(201).json(toWireAppointment(appointment));
}

export const updateSchema = z.object({
  appointmentType: z.string().min(1).optional(),
  date: dateOnlySchema.optional(),
  time: timeSchema.optional(),
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(appointmentStatusCodec.wireValues).optional(),
});

export async function update(req: Request, res: Response) {
  const input = req.body as z.infer<typeof updateSchema>;
  const actorUserId = req.auth!.userId;

  const appointment = await inBookingTransaction(async (tx) => {
    const existing = await tx.appointment.findUnique({
      where: { id: req.params.id },
      include: withType,
    });
    if (!existing) throw notFound("That appointment could not be found.");

    const type = input.appointmentType
      ? await requireTypeByName(tx, input.appointmentType)
      : existing.type;

    const date = input.date ?? toWireAppointment(existing).date;
    const time = input.time ?? toWireAppointment(existing).time;
    const startsAt = toInstant(date, time);
    const moved = startsAt.getTime() !== existing.startsAt.getTime();

    const durationMinutes = resolveDuration({
      requested: input.durationMinutes,
      // An existing appointment already has a length that somebody chose;
      // changing the type alone should not silently re-derive it.
      firstVisit: false,
      firstVisitMinutes: existing.durationMinutes,
      typeMinutes: input.appointmentType ? type.durationMinutes : existing.durationMinutes,
    });

    const nextStatus = input.status
      ? appointmentStatusCodec.toDb(input.status)
      : existing.status;

    // Re-validate only when the appointment actually moves or changes length,
    // and never for a cancellation — a cancelled visit occupies nothing.
    if ((moved || durationMinutes !== existing.durationMinutes) && nextStatus !== "CANCELLED") {
      assertInsideAvailability(
        await windowsForDate(tx, existing.doctorId, startsAt),
        time,
        durationMinutes,
      );
      await assertNoOverlap(tx, existing.doctorId, startsAt, durationMinutes, existing.id);
    }

    const saved = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        typeId: type.id,
        startsAt,
        durationMinutes,
        status: nextStatus,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: withType,
    });

    if (nextStatus !== existing.status) {
      await writeStatusAudit(tx, actorUserId, existing.id, existing.status, nextStatus);
    }

    return saved;
  });

  res.json(toWireAppointment(appointment));
}

export const statusSchema = z.object({
  status: z.enum(appointmentStatusCodec.wireValues),
});

export async function setStatus(req: Request, res: Response) {
  const { status } = req.body as z.infer<typeof statusSchema>;
  const nextStatus = appointmentStatusCodec.toDb(status);
  const actorUserId = req.auth!.userId;

  const appointment = await prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("That appointment could not be found.");

    // A doctor marks up their own list and nobody else's. Attendance feeds the
    // clinic's attendance rate and the recall sweep, so writing it on a
    // colleague's patient corrupts both.
    scopeDoctorId(req, existing.doctorId);

    const saved = await tx.appointment.update({
      where: { id: existing.id },
      data: { status: nextStatus },
      include: withType,
    });

    if (nextStatus !== existing.status) {
      await writeStatusAudit(tx, actorUserId, existing.id, existing.status, nextStatus);
    }

    return saved;
  });

  res.json(toWireAppointment(appointment));
}

/**
 * Who marked a visit attended, and when. Attendance drives the recall sweep and
 * the clinic's attendance rate, so a status change is a claim about what
 * happened in the building and needs to be attributable.
 */
function writeStatusAudit(
  tx: Tx,
  actorUserId: string,
  appointmentId: string,
  from: string,
  to: string,
) {
  return tx.auditLog.create({
    data: {
      actorUserId,
      action: "appointment.status_changed",
      entity: "Appointment",
      entityId: appointmentId,
      meta: {
        from: appointmentStatusCodec.toWire(from as never),
        to: appointmentStatusCodec.toWire(to as never),
      },
    },
  });
}
