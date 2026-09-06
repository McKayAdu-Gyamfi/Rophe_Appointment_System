import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/httpError";
import { toWirePatient } from "../mappers/recordMappers";
import { buildVisitSummary, type RecallThresholds } from "../services/visits";

// ---------------------------------------------------------------------------
// Recalls and visit summaries.
//
// Every number here is derived on read. Nothing about "lapsed" is written
// down, so nothing has to be un-written when a patient walks back in.
//
// Thresholds come from ClinicSettings rather than constants: the clinic
// settled on six months, and the point of putting it in a row was that they
// can change their mind without a deploy.
// ---------------------------------------------------------------------------

async function loadThresholds(): Promise<RecallThresholds> {
  const settings = await prisma.clinicSettings.findUnique({ where: { id: "clinic" } });
  return {
    recallMonths: settings?.recallMonths ?? 6,
    lapsingMonths: settings?.lapsingMonths ?? 5,
    recallCooldownDays: settings?.recallCooldownDays ?? 30,
  };
}

/**
 * The whole register with its recall state, not just the patients who are due.
 *
 * The recalls screen shows counts across every bucket — due, lapsing, recently
 * contacted, unbooked — and lets front desk switch between them, so filtering
 * to the worklist here would leave the other four tabs unable to count.
 */
export async function listRecalls(_req: Request, res: Response) {
  const now = new Date();
  const thresholds = await loadThresholds();

  const [patients, appointments, recalls] = await Promise.all([
    prisma.patient.findMany({ orderBy: { fullName: "asc" } }),
    prisma.appointment.findMany({ include: { type: true } }),
    // The cooldown read: (patientId, type, sentAt).
    prisma.message.findMany({
      where: { type: "RECALL" },
      select: { patientId: true, sentAt: true },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  // One pass to group, rather than a query per patient — the screen asks for
  // every patient at once and N round trips is the shape that gets slow.
  const byPatient = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const list = byPatient.get(appointment.patientId);
    if (list) list.push(appointment);
    else byPatient.set(appointment.patientId, [appointment]);
  }

  // Ordered newest first, so the first hit per patient is the latest recall.
  const lastRecallAt = new Map<string, Date>();
  for (const message of recalls) {
    if (!lastRecallAt.has(message.patientId)) lastRecallAt.set(message.patientId, message.sentAt);
  }

  res.json(
    patients.map((patient) => ({
      patient: toWirePatient(patient),
      summary: buildVisitSummary({
        patientId: patient.id,
        registeredAt: patient.registeredAt,
        appointments: byPatient.get(patient.id) ?? [],
        lastRecallAt: lastRecallAt.get(patient.id),
        thresholds,
        now,
      }),
    })),
  );
}

export async function getPatientSummary(req: Request, res: Response) {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!patient) throw notFound("That patient record could not be found.");

  const now = new Date();
  const [thresholds, appointments, lastRecall] = await Promise.all([
    loadThresholds(),
    // Hits @@index([patientId, status, startsAt]).
    prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: { type: true },
      orderBy: { startsAt: "desc" },
    }),
    prisma.message.findFirst({
      where: { patientId: patient.id, type: "RECALL" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
  ]);

  res.json(
    buildVisitSummary({
      patientId: patient.id,
      registeredAt: patient.registeredAt,
      appointments,
      lastRecallAt: lastRecall?.sentAt,
      thresholds,
      now,
    }),
  );
}
