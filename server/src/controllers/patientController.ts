import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// GET /api/patients
export async function listPatients(_req: Request, res: Response) {
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(patients);
}

// POST /api/patients
export async function createPatient(req: Request, res: Response) {
  const { name, phone, whatsapp, email, preferredChannel } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "name and phone are required" });
  }
  const patient = await prisma.patient.create({
    data: { name, phone, whatsapp, email, preferredChannel },
  });
  res.status(201).json(patient);
}
