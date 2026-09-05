import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, validateBody } from "../middleware/validate";

export const list = asyncHandler(async (_req, res) => {
  const types = await prisma.appointmentType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json(types);
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  durationMinutes: z.number().int().positive("Duration must be a positive number").default(30),
  sortOrder: z.number().int().default(0),
});

export const create = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createSchema>;
    const type = await prisma.appointmentType.create({ data });
    res.status(201).json(type);
  }),
];

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  durationMinutes: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const update = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body as z.infer<typeof updateSchema>;
    const type = await prisma.appointmentType.update({
      where: { id },
      data,
    });
    res.json(type);
  }),
];

const reorderSchema = z.array(
  z.object({
    id: z.string(),
    sortOrder: z.number().int(),
  })
);

export const reorder = [
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const items = req.body as z.infer<typeof reorderSchema>;
    
    await prisma.$transaction(
      items.map((item) =>
        prisma.appointmentType.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    
    res.status(204).send();
  }),
];

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const count = await prisma.appointment.count({
    where: { typeId: id },
  });
  
  if (count > 0) {
    await prisma.appointmentType.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await prisma.appointmentType.delete({
      where: { id },
    });
  }
  
  res.status(204).send();
});
