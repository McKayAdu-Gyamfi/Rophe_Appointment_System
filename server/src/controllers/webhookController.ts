import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { forbidden, notFound } from "../lib/httpError";
import { env } from "../config/env";
import { messageProvider } from "../services/messageProvider";

// ---------------------------------------------------------------------------
// Delivery callbacks.
//
// Public, because the provider calls it with no session — which makes the
// signature check the only thing standing between this endpoint and anyone who
// wants to mark the clinic's messages delivered.
//
// Two properties a provider's retry behaviour demands:
//
//   Idempotent. The same callback will arrive more than once, and the second
//   one must not undo the first. Delivery only ever moves forward.
//
//   Forgiving. An id we have never seen is answered 200 and logged, not 500 —
//   a provider that gets an error will retry the same unknown id forever, and
//   a 500 here is an outage that looks like theirs.
// ---------------------------------------------------------------------------

export async function messageDelivery(req: Request, res: Response) {
  if (req.params.provider !== env.messageProvider) {
    throw notFound("No webhook is configured for that provider.");
  }

  if (!messageProvider.verifyWebhook(req)) {
    throw forbidden("That callback could not be verified.");
  }

  const { providerMessageId, status, error } = messageProvider.parseWebhook(req.body);

  const message = await prisma.message.findUnique({ where: { providerMessageId } });
  if (!message) {
    console.warn(
      `[webhook] Delivery callback for unknown providerMessageId ${providerMessageId} — ignoring.`,
    );
    res.status(200).json({ ok: true, matched: false });
    return;
  }

  // DELIVERED is terminal: a later "sent" is a stale retry overtaking the
  // confirmation, and applying it would walk the status backwards.
  if (message.deliveryStatus === "DELIVERED" && status !== "FAILED") {
    res.status(200).json({ ok: true, matched: true, changed: false });
    return;
  }

  await prisma.message.update({
    where: { id: message.id },
    data: {
      deliveryStatus: status,
      providerError: status === "FAILED" ? (error ?? "Undeliverable.") : null,
      // Set once, on the callback that first confirmed the device.
      ...(status === "DELIVERED" && !message.deliveredAt && { deliveredAt: new Date() }),
    },
  });

  res.status(200).json({ ok: true, matched: true, changed: true });
}
