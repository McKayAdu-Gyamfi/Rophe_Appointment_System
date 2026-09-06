import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, validateBody, validateQuery, query, phoneSchema, emailSchema, channelSchema, dateOnlySchema } from "../middleware/validate";
import { badRequest, notFound } from "../lib/httpError";
import { toWirePatient, toWireAppointment } from "../mappers/recordMappers";

/**
 * A Ghanaian number, reduced to the part that identifies the subscriber.
 *
 * The clinic types numbers three ways — "+233 24 123 4567" off a card,
 * "024 123 4567" off a phone, "0241234567" in a hurry — and all three are one
 * number. Stripping punctuation is not enough: the international form carries
 * a 233 the local form spells as a leading 0, so the digits genuinely differ
 * and neither string contains the other. Dropping both leaves "241234567",
 * which is what front desk is really searching for.
 *
 * Kept as one function used on both sides of the comparison, so the stored
 * value and the typed value can never be normalised differently.
 */
export function nationalDigits(input: string): string {
  return input
    .replace(/\D/g, "")
    .replace(/^233/, "")
    .replace(/^0+/, "");
}

/**
 * The same reduction, in SQL, for a stored column. A fixed fragment naming a
 * column we control — the search text itself is still a bound parameter.
 */
function national(column: string) {
  return Prisma.raw(
    `regexp_replace(regexp_replace(regexp_replace(${column}, '\\D', '', 'g'), '^233', ''), '^0+', '')`,
  );
}

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

      const searchConditions: any[] = [
        { fullName: { contains: qLower, mode: "insensitive" } },
        { email: { contains: qLower, mode: "insensitive" } },
      ];

      const dialled = nationalDigits(qParams.q);

      if (dialled.length >= 3) {
        // Normalise on both sides, then substring-match. Comparing raw digits
        // is what made the recorded case fail: a number saved from a business
        // card as "+233 24 123 4567" and one dialled off a phone as
        // "024 123 4567" are the same number, and neither contains the other.
        const matching = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Patient"
          WHERE ${national("phone")} LIKE ${`%${dialled}%`}
             OR ("whatsappNumber" IS NOT NULL
                 AND ${national('"whatsappNumber"')} LIKE ${`%${dialled}%`})
        `;

        if (matching.length > 0) {
          searchConditions.push({ id: { in: matching.map((m) => m.id) } });
        }
      }

      where.OR = searchConditions;
    }

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 50,
    });

    res.json(patients.map(toWirePatient));
  }),
];

export const get = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        include: { type: true },
        orderBy: { startsAt: "desc" },
      },
    },
  });

  if (!patient) {
    throw notFound("That patient record could not be found.");
  }

  res.json({
    ...toWirePatient(patient),
    appointments: patient.appointments.map(toWireAppointment),
  });
});

const createSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  phone: phoneSchema,
  whatsappNumber: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  dateOfBirth: dateOnlySchema.optional().nullable().or(z.literal("")),
    // The default is the parsed (database) value: zod applies it in place of
  // the transform when the field is absent.
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

    res.status(201).json(toWirePatient(patient));
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
      throw notFound("That patient record could not be found.");
    }

    const nextEmail = data.email !== undefined ? (data.email === "" ? null : data.email) : existing.email;
    const nextChannel = data.preferredChannel !== undefined ? data.preferredChannel : existing.preferredChannel;

    if (nextChannel === "EMAIL" && !nextEmail) {
      throw badRequest("Add an email address before making email the preferred channel.");
    }

    const updateData: any = { ...data };
    if (data.email !== undefined) updateData.email = nextEmail;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.registeredAt !== undefined) updateData.registeredAt = data.registeredAt ? new Date(data.registeredAt) : undefined;

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
    });

    res.json(toWirePatient(patient));
  }),
];
