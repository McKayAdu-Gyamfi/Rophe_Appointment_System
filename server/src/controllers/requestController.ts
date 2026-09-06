import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound, forbidden } from "../lib/httpError";
import { hashToken } from "../lib/crypto";
import { messageProvider } from "../services/messageProvider";
import { requestTypeCodec } from "../mappers/enums";
import { toWirePatientRequest } from "../mappers/recordMappers";
import { toInstant } from "../mappers/datetime";
import { dateOnlySchema, timeSchema } from "../middleware/validate";

// The portal sends what the frontend types describe: a lowercase request type
// and a separate date and clock time. The instant is assembled here.
export const createRequestSchema = z.object({
  requestType: z.enum(requestTypeCodec.wireValues).transform((v) => requestTypeCodec.toDb(v)),
  requestedDate: dateOnlySchema.optional(),
  requestedTime: timeSchema.optional(),
  reason: z.string().optional(),
});

/** Only a decision — a request cannot be moved back to pending. */
export const respondRequestSchema = z.object({
  status: z.enum(["confirmed", "declined"]).transform((v) =>
    v === "confirmed" ? ("CONFIRMED" as const) : ("DECLINED" as const),
  ),
});

export async function list(req: Request, res: Response) {
  // The requests screen resolves patients and appointments from its own
  // fetches, so the row itself is all that crosses the wire.
  const requests = await prisma.patientRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(requests.map(toWirePatientRequest));
}

export async function create(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw forbidden("Valid portal token required in Authorization header");
  }

  const token = authHeader.split(" ")[1];
  const tokenHash = hashToken(token);

  const portalToken = await prisma.portalAccessToken.findUnique({
    where: { tokenHash },
    include: { appointment: true }
  });

  if (!portalToken) {
    throw forbidden("Invalid portal token");
  }

  if (portalToken.revokedAt || portalToken.expiresAt < new Date()) {
    throw forbidden("Portal token expired or revoked");
  }

  const { requestType, requestedDate, requestedTime, reason } = req.body as z.infer<
    typeof createRequestSchema
  >;

  if (requestType === "RESCHEDULE" && (!requestedDate || !requestedTime)) {
    throw badRequest("Choose a new date and time for a reschedule request.");
  }

  const requestedStartsAt =
    requestedDate && requestedTime ? toInstant(requestedDate, requestedTime) : null;

  const patientRequest = await prisma.$transaction(async (tx) => {
    // Record usage
    await tx.portalAccessToken.update({
      where: { id: portalToken.id },
      data: { lastUsedAt: new Date() }
    });

    return tx.patientRequest.create({
      data: {
        appointmentId: portalToken.appointmentId,
        patientId: portalToken.appointment.patientId,
        requestType,
        requestedStartsAt,
        reason,
        status: "PENDING",
      }
    });
  });

  res.status(201).json(toWirePatientRequest(patientRequest));
}

export async function respond(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body as z.infer<typeof respondRequestSchema>;

  const patientRequest = await prisma.$transaction(async (tx) => {
    const pr = await tx.patientRequest.findUnique({
      where: { id },
      include: {
        appointment: {
          include: { patient: true }
        }
      }
    });

    if (!pr) throw notFound("Request not found");
    if (pr.status !== "PENDING") throw badRequest(`Request is already ${pr.status}`);

    // Track A (Appointments #10) missing integration:
    // When #10 merges, call validateSlot() here for reschedule requests.
    // if (status === "CONFIRMED" && pr.requestType === "RESCHEDULE") {
    //   await validateSlot(tx, pr.requestedStartsAt);
    // }

    if (status === "CONFIRMED") {
      if (pr.requestType === "RESCHEDULE" && pr.requestedStartsAt) {
        await tx.appointment.update({
          where: { id: pr.appointmentId },
          data: {
            startsAt: pr.requestedStartsAt,
            status: "RESCHEDULED",
          }
        });
      } else if (pr.requestType === "CANCELLATION") {
        await tx.appointment.update({
          where: { id: pr.appointmentId },
          data: {
            status: "CANCELLED",
          }
        });
      }
    }

    const updatedPr = await tx.patientRequest.update({
      where: { id },
      data: {
        status,
        respondedAt: new Date(),
        respondedById: req.auth!.userId,
      }
    });

    // Track B (Messages #11) missing integration:
    // For now we just log out using the provider. Once templates exist, this should
    // construct a real template render.
    const messageBody = status === "CONFIRMED" 
      ? `Your appointment request has been confirmed by the clinic.`
      : `Unfortunately, the clinic declined your appointment request. Please contact us.`;
    
    messageProvider.send({
      channel: pr.appointment.patient.preferredChannel,
      to: pr.appointment.patient.preferredChannel === "EMAIL" ? (pr.appointment.patient.email || "") : pr.appointment.patient.phone,
      body: messageBody,
      subject: "Appointment Update"
    }).catch(err => {
      console.error("[RequestController] Failed to send decision message", err);
    });

    return updatedPr;
  });

  res.json(toWirePatientRequest(patientRequest));
}
