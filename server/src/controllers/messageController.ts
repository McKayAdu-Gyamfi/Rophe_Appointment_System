import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, query, validateQuery } from "../middleware/validate";
import {
  channelCodec,
  deliveryStatusCodec,
  messageTypeCodec,
} from "../mappers/enums";
import { toWireMessage } from "../mappers/recordMappers";
import { sendMessage } from "../services/messaging";

// ---------------------------------------------------------------------------
// The message log.
//
// A record of what the clinic actually said to whom, and whether it arrived.
// The prototype faked delivery with a timer; this reads the row the provider
// and its webhook wrote.
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  channel: z.enum(channelCodec.wireValues).optional(),
  type: z.enum(messageTypeCodec.wireValues).optional(),
  deliveryStatus: z.enum(deliveryStatusCodec.wireValues).optional(),
  patientId: z.string().optional(),
});

export const list = [
  validateQuery(listQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = query<z.infer<typeof listQuerySchema>>(req);

    const messages = await prisma.message.findMany({
      where: {
        ...(filters.channel && { channel: channelCodec.toDb(filters.channel) }),
        ...(filters.type && { type: messageTypeCodec.toDb(filters.type) }),
        ...(filters.deliveryStatus && {
          deliveryStatus: deliveryStatusCodec.toDb(filters.deliveryStatus),
        }),
        ...(filters.patientId && { patientId: filters.patientId }),
      },
      // Matches @@index([sentAt]).
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    res.json(messages.map(toWireMessage));
  }),
];

export const sendSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  type: z.enum(messageTypeCodec.wireValues),
  channel: z.enum(channelCodec.wireValues).optional(),
  // The prototype sent the rendered text up from the browser. It is ignored:
  // the server renders from the clinic's current template, so what is logged
  // is what was actually sent rather than what a client claimed it sent.
  contentPreview: z.string().optional(),
});

export async function send(req: Request, res: Response) {
  const input = req.body as z.infer<typeof sendSchema>;

  const message = await sendMessage({
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    type: messageTypeCodec.toDb(input.type),
    channel: input.channel ? channelCodec.toDb(input.channel) : undefined,
  });

  res.status(201).json(toWireMessage(message));
}
