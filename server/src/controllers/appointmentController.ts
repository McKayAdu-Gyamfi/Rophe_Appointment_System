import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// GET /api/appointments
export async function listAppointments(_req: Request, res: Response) {
  const appointments = await prisma.appointment.findMany({
    include: { patient: true, doctor: true },
    orderBy: { scheduledAt: "asc" },
  });
  res.json(appointments);
}

// POST /api/appointments
export async function createAppointment(req: Request, res: Response) {
  const { patientId, doctorId, scheduledAt, type } = req.body;
  if (!patientId || !scheduledAt || !type) {
    return res
      .status(400)
      .json({ error: "patientId, scheduledAt and type are required" });
  }
  const appointment = await prisma.appointment.create({
    data: { patientId, doctorId, scheduledAt: new Date(scheduledAt), type },
  });
  res.status(201).json(appointment);
}

// PATCH /api/appointments/:id/status
export async function updateAppointmentStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;
  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status },
  });
  res.json(appointment);
}
