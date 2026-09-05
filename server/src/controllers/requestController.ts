import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound, forbidden } from "../lib/httpError";
import { hashToken } from "../lib/crypto";
import { messageProvider } from "../services/messageProvider";

export const createRequestSchema = z.object({
  requestType: z.enum(["RESCHEDULE", "CANCELLATION"]),
  requestedStartsAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

export const respondRequestSchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED"]),
});

export async function list(req: Request, res: Response) {
  const requests = await prisma.patientRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      appointment: true,
      patient: true,
      respondedBy: {
        select: { id: true, fullName: true, role: true }
      }
    }
  });
  res.json(requests);
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

  const { requestType, requestedStartsAt, reason } = req.body as z.infer<typeof createRequestSchema>;

  if (requestType === "RESCHEDULE" && !requestedStartsAt) {
    throw badRequest("A reschedule request requires a requestedStartsAt time.");
  }

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
        requestedStartsAt: requestedStartsAt ? new Date(requestedStartsAt) : null,
        reason,
        status: "PENDING",
      }
    });
  });

  res.status(201).json(patientRequest);
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

  res.json(patientRequest);
}
