import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/httpError";
import { validateTemplate } from "../lib/templates";
import { messageTypeCodec } from "../mappers/enums";
import { toWireTemplate } from "../mappers/recordMappers";

export const updateTemplateSchema = z.object({
  body: z.string().min(1),
  emailSubject: z.string().min(1),
});

export async function list(req: Request, res: Response) {
  const templates = await prisma.messageTemplate.findMany({
    include: {
      revisions: {
        orderBy: { version: "desc" },
      },
    },
    orderBy: { type: "asc" },
  });
  res.json(templates.map(toWireTemplate));
}

export async function update(req: Request, res: Response) {
  const { type } = req.params;
  const { body, emailSubject } = req.body as z.infer<typeof updateTemplateSchema>;

  const dbType = messageTypeCodec.toDb(type);

  const issues = validateTemplate(dbType, body, emailSubject);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    throw badRequest(errors[0].message);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.messageTemplate.findUnique({
      where: { type: dbType },
    });

    if (!current) {
      throw notFound(`Template ${type} not found.`);
    }

    // Save history
    await tx.templateRevision.create({
      data: {
        templateId: current.id,
        version: current.version,
        body: current.body,
        emailSubject: current.emailSubject,
        savedAt: current.updatedAt,
        savedByName: current.updatedByName,
      },
    });

    // Update
    return tx.messageTemplate.update({
      where: { id: current.id },
      data: {
        body,
        emailSubject,
        version: current.version + 1,
        updatedByName: req.auth!.fullName,
      },
      include: {
        revisions: { orderBy: { version: "desc" } },
      },
    });
  });

  res.json(toWireTemplate(updated));
}

export async function revert(req: Request, res: Response) {
  const { type, version } = req.params;
  const versionNum = parseInt(version, 10);

  if (isNaN(versionNum)) {
    throw badRequest("Version must be a number");
  }

  const dbType = messageTypeCodec.toDb(type);

  const reverted = await prisma.$transaction(async (tx) => {
    const current = await tx.messageTemplate.findUnique({
      where: { type: dbType },
    });

    if (!current) {
      throw notFound(`Template ${type} not found.`);
    }

    const revision = await tx.templateRevision.findUnique({
      where: {
        templateId_version: {
          templateId: current.id,
          version: versionNum,
        },
      },
    });

    if (!revision) {
      throw notFound(`Revision v${versionNum} not found for template ${type}.`);
    }

    // Push the current state to history
    await tx.templateRevision.create({
      data: {
        templateId: current.id,
        version: current.version,
        body: current.body,
        emailSubject: current.emailSubject,
        savedAt: current.updatedAt,
        savedByName: current.updatedByName,
      },
    });

    // Revert to the old state, but bump version
    return tx.messageTemplate.update({
      where: { id: current.id },
      data: {
        body: revision.body,
        emailSubject: revision.emailSubject,
        version: current.version + 1,
        updatedByName: req.auth!.fullName,
      },
      include: {
        revisions: { orderBy: { version: "desc" } },
      },
    });
  });

  res.json(toWireTemplate(reverted));
}
