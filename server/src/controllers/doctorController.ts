import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { toFrontendDoctor } from "../mappers/doctorMapper";
import { notFound, badRequest } from "../lib/httpError";

export async function listDoctors(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === "true";

  const doctors = await prisma.doctor.findMany({
    where: includeInactive ? undefined : { active: true },
    include: { user: true },
    orderBy: { user: { fullName: "asc" } },
  });

  res.json(doctors.map(toFrontendDoctor));
}

export async function getDoctor(req: Request, res: Response) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });

  if (!doctor) {
    throw notFound("Doctor not found");
  }

  res.json(toFrontendDoctor(doctor));
}

export async function updateDoctor(req: Request, res: Response) {
  const { specialty, active } = req.body;

  if (specialty !== undefined && typeof specialty !== "string") {
    throw badRequest("Specialty must be a string");
  }
  if (active !== undefined && typeof active !== "boolean") {
    throw badRequest("Active must be a boolean");
  }

  const existingDoctor = await prisma.doctor.findUnique({
    where: { id: req.params.id },
  });

  if (!existingDoctor) {
    throw notFound("Doctor not found");
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: req.params.id },
    data: {
      ...(specialty !== undefined && { specialty }),
      ...(active !== undefined && { active }),
    },
    include: { user: true },
  });

  res.json(toFrontendDoctor(updatedDoctor));
}
