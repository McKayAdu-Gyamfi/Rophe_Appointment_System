import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, validateBody, validateQuery, query, phoneSchema, emailSchema, channelSchema, dateOnlySchema } from "../middleware/validate";
import { badRequest } from "../lib/httpError";

const listQuerySchema = z.object({
  q: z.string().optional(),
  channel: channelSchema.optional(),
});

export const list = [
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const qParams = query<z.infer<typeof listQuerySchema>>(req);
    const where: any = {};

    if (qParams.channel) {
      where.preferredChannel = qParams.channel;
    }

    if (qParams.q) {
      const qLower = qParams.q.toLowerCase().trim();
      const digits = qLower.replace(/\D/g, "");

      const searchConditions: any[] = [
        { fullName: { contains: qLower, mode: "insensitive" } },
        { email: { contains: qLower, mode: "insensitive" } },
      ];

      if (digits.length > 0) {
        // Find matching IDs via raw query for phone digits
        const matching = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Patient"
          WHERE regexp_replace(phone, '\\D', '', 'g') LIKE ${'%' + digits + '%'}
        `;
        const phoneMatchingIds = matching.map(m => m.id);

        if (phoneMatchingIds.length > 0) {
          searchConditions.push({ id: { in: phoneMatchingIds } });
        }
      }

      where.OR = searchConditions;
    }

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 50,
    });

    res.json(patients);
  }),
];

export const get = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { startsAt: "desc" },
      },
    },
  });

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  res.json(patient);
});

const createSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  phone: phoneSchema,
  whatsappNumber: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  dateOfBirth: dateOnlySchema.optional().nullable().or(z.literal("")),
  preferredChannel: channelSchema.default("WHATSAPP"),
  notes: z.string().optional().nullable(),
  registeredAt: z.string().datetime().optional(),
}).refine(data => {
  if (data.preferredChannel === "EMAIL" && (!data.email || data.email === "")) return false;
  return true;
}, {
  message: "An email address is required if EMAIL is the preferred channel.",
  path: ["preferredChannel"],
});

export const create = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createSchema>;
    
    // Clean up empty strings to null for optional fields
    const email = data.email === "" ? null : data.email;
    const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    const registeredAt = data.registeredAt ? new Date(data.registeredAt) : new Date();

    const patient = await prisma.patient.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        whatsappNumber: data.whatsappNumber,
        email,
        dateOfBirth,
        preferredChannel: data.preferredChannel,
        notes: data.notes,
        registeredAt,
      },
    });

    res.status(201).json(patient);
  }),
];

const updateSchema = z.object({
  fullName: z.string().min(1, "Name is required").optional(),
  phone: phoneSchema.optional(),
  whatsappNumber: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  dateOfBirth: dateOnlySchema.optional().nullable().or(z.literal("")),
  preferredChannel: channelSchema.optional(),
  notes: z.string().optional().nullable(),
  registeredAt: z.string().datetime().optional(),
});

export const update = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body as z.infer<typeof updateSchema>;

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const nextEmail = data.email !== undefined ? (data.email === "" ? null : data.email) : existing.email;
    const nextChannel = data.preferredChannel !== undefined ? data.preferredChannel : existing.preferredChannel;

    if (nextChannel === "EMAIL" && !nextEmail) {
      res.status(400).json({ error: { message: "An email address is required if EMAIL is the preferred channel." } });
      return;
    }

    const updateData: any = { ...data };
    if (data.email !== undefined) updateData.email = nextEmail;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.registeredAt !== undefined) updateData.registeredAt = data.registeredAt ? new Date(data.registeredAt) : undefined;

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
    });

    res.json(patient);
  }),
];
