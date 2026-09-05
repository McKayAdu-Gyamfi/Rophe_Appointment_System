import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, validateBody, timeSchema } from "../middleware/validate";

export const getSettings = asyncHandler(async (_req, res) => {
  let settings = await prisma.clinicSettings.findUnique({
    where: { id: "clinic" },
  });

  if (!settings) {
    settings = await prisma.clinicSettings.create({
      data: { id: "clinic" },
    });
  }

  res.json(settings);
});

const updateSchema = z.object({
  firstVisitMinutes: z.number().int().positive().optional(),
  slotMinutes: z.number().int().positive().optional(),
  dayStart: timeSchema.optional(),
  dayEnd: timeSchema.optional(),
  recallMonths: z.number().int().positive().optional(),
  lapsingMonths: z.number().int().positive().optional(),
  recallCooldownDays: z.number().int().positive().optional(),
  portalTokenDays: z.number().int().positive().optional(),
});

export const updateSettings = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof updateSchema>;
    const settings = await prisma.clinicSettings.upsert({
      where: { id: "clinic" },
      update: data,
      create: { id: "clinic", ...data },
    });
    res.json(settings);
  }),
];
