import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/httpError";
import { dateOnlySchema, timeSchema } from "../middleware/validate";
import { resolveDoctorId } from "../middleware/auth";
import { toWireAvailability, toWireException } from "../mappers/recordMappers";
import { recordAudit } from "../services/audit";

// ---------------------------------------------------------------------------
// When a doctor works.
//
// Two layers, deliberately separate:
//
//   DoctorAvailability is the weekly pattern — "Tuesdays, 09:00–13:00". It
//   repeats forever and is edited a day at a time.
//
//   AvailabilityException is a single date that does not follow the pattern —
//   a conference, a public holiday, a one-off late start. It overrides the
//   weekly rows for that date and nothing else.
//
// The pattern has no "closed" row. A day the doctor does not work simply has
// no windows, which is why PUT replaces a day wholesale rather than patching
// individual rows: there is only one representation of closed, so the two can
// never disagree.
//
// Every route resolves the doctor through resolveDoctorId, so a doctor can
// only ever read and write their own hours.
// ---------------------------------------------------------------------------

/**
 * Which doctor this request is about.
 *
 * "me" is the signed-in doctor, so their own screens send no id at all — there
 * is nothing in the request to tamper with, and the server decides whose hours
 * are being read or written. Front desk must name a doctor explicitly;
 * resolveDoctorId refuses an unqualified "me" from an account that is not one.
 */
function scopedDoctorId(req: Request): string {
  const param = req.params.id;
  return resolveDoctorId(req, param === "me" ? undefined : param);
}

/** Confirm the doctor exists before writing rows that hang off them. */
async function requireDoctor(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw notFound("That doctor could not be found.");
  return doctor;
}

const dayOfWeekSchema = z.coerce
  .number()
  .int()
  .min(0, "Day must be 0 (Sunday) to 6 (Saturday).")
  .max(6, "Day must be 0 (Sunday) to 6 (Saturday).");

/**
 * Windows must be orderable and must not overlap. Overlapping windows would
 * make a slot open twice over, and every consumer — the grid, the booking
 * conflict check — would have to decide which one wins.
 */
function assertUsableWindows(windows: { startTime: string; endTime: string }[]) {
  const sorted = [...windows].sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (const [index, window] of sorted.entries()) {
    if (window.startTime >= window.endTime) {
      throw badRequest(`A window has to end after it starts — got ${window.startTime}–${window.endTime}.`);
    }
    const previous = sorted[index - 1];
    if (previous && window.startTime < previous.endTime) {
      throw badRequest(
        `Those windows overlap: ${previous.startTime}–${previous.endTime} and ${window.startTime}–${window.endTime}.`,
      );
    }
  }

  return sorted;
}

// --- Weekly pattern --------------------------------------------------------

/**
 * Every doctor's hours in one call.
 *
 * The front-desk screens — the calendar, the booking form, the dashboard —
 * need the whole clinic's week, and each row carries its doctorId so callers
 * filter to whichever doctor they are showing. One request rather than one per
 * doctor: the alternative gets slower every time the clinic hires.
 */
export async function getAllAvailability(_req: Request, res: Response) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [windows, exceptions] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { doctor: { active: true } },
      orderBy: [{ doctorId: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.availabilityException.findMany({
      where: { doctor: { active: true }, date: { gte: today } },
      orderBy: { date: "asc" },
    }),
  ]);

  res.json({
    windows: windows.map(toWireAvailability),
    exceptions: exceptions.map(toWireException),
  });
}

export async function getAvailability(req: Request, res: Response) {
  const doctorId = scopedDoctorId(req);
  await requireDoctor(doctorId);

  // Today's exceptions still matter — the clinic is part-way through the day.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [windows, exceptions] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.availabilityException.findMany({
      where: { doctorId, date: { gte: today } },
      orderBy: { date: "asc" },
    }),
  ]);

  res.json({
    windows: windows.map(toWireAvailability),
    exceptions: exceptions.map(toWireException),
  });
}

export const setDaySchema = z.object({
  // The client posts whole DoctorAvailability objects; only the times are
  // trusted. doctorId and dayOfWeek come from the path, so a body cannot
  // rewrite somebody else's Tuesday.
  windows: z
    .array(z.object({ startTime: timeSchema, endTime: timeSchema }))
    .max(12, "That is more windows than a day can hold."),
});

export async function setDay(req: Request, res: Response) {
  const doctorId = scopedDoctorId(req);
  await requireDoctor(doctorId);

  const dayOfWeek = dayOfWeekSchema.parse(req.params.day);
  const { windows } = req.body as z.infer<typeof setDaySchema>;
  const sorted = assertUsableWindows(windows);

  // Replace wholesale: the request states what the day is, not how it differs
  // from what is stored, so sending it twice leaves the same rows behind.
  const saved = await prisma.$transaction(async (tx) => {
    await tx.doctorAvailability.deleteMany({ where: { doctorId, dayOfWeek } });

    if (sorted.length > 0) {
      await tx.doctorAvailability.createMany({
        data: sorted.map((window) => ({ doctorId, dayOfWeek, ...window })),
      });
    }

    return tx.doctorAvailability.findMany({
      where: { doctorId, dayOfWeek },
      orderBy: { startTime: "asc" },
    });
  });

  // Appointments are never touched here. A patient booked into a slot the
  // doctor has just closed keeps their appointment; front desk is told about
  // the clash and moves it deliberately.
  recordAudit({
    actorUserId: req.auth!.userId,
    action: "availability.day_replaced",
    entity: "Doctor",
    entityId: doctorId,
    meta: { dayOfWeek, windows: sorted },
  });

  res.json(saved.map(toWireAvailability));
}

// --- Date exceptions -------------------------------------------------------

export const createExceptionSchema = z
  .object({
    date: dateOnlySchema,
    isClosed: z.boolean().default(true),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((data) => data.isClosed || (data.startTime && data.endTime), {
    message: "Give the hours that replace the usual pattern, or mark the day closed.",
    path: ["startTime"],
  })
  .refine((data) => !data.startTime || !data.endTime || data.startTime < data.endTime, {
    message: "That day has to end after it starts.",
    path: ["endTime"],
  });

export async function createException(req: Request, res: Response) {
  const doctorId = scopedDoctorId(req);
  await requireDoctor(doctorId);

  const input = req.body as z.infer<typeof createExceptionSchema>;
  const date = new Date(`${input.date}T00:00:00.000Z`);

  // A closed day and replacement hours are contradictory statements about the
  // same date, and the unique index cannot catch it because it includes a
  // nullable startTime.
  const clash = await prisma.availabilityException.findFirst({
    where: {
      doctorId,
      date,
      ...(input.isClosed ? {} : { startTime: input.startTime }),
    },
  });
  if (clash) {
    throw conflict("There is already an exception on that date. Remove it before adding another.");
  }

  const exception = await prisma.availabilityException.create({
    data: {
      doctorId,
      date,
      isClosed: input.isClosed,
      startTime: input.isClosed ? null : input.startTime,
      endTime: input.isClosed ? null : input.endTime,
      reason: input.reason,
    },
  });

  recordAudit({
    actorUserId: req.auth!.userId,
    action: "availability.exception_added",
    entity: "Doctor",
    entityId: doctorId,
    meta: { date: input.date, isClosed: input.isClosed },
  });

  res.status(201).json(toWireException(exception));
}

export async function deleteException(req: Request, res: Response) {
  const doctorId = scopedDoctorId(req);

  // Scope the delete to the resolved doctor: an id alone must not be enough to
  // remove somebody else's day off.
  const exception = await prisma.availabilityException.findFirst({
    where: { id: req.params.exceptionId, doctorId },
  });
  if (!exception) throw notFound("That exception could not be found.");

  await prisma.availabilityException.delete({ where: { id: exception.id } });

  recordAudit({
    actorUserId: req.auth!.userId,
    action: "availability.exception_removed",
    entity: "Doctor",
    entityId: doctorId,
    meta: { exceptionId: exception.id },
  });

  res.status(204).end();
}
