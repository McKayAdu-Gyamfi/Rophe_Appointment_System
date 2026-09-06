import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/httpError";
import { messageProvider } from "../services/messageProvider";
import { toWirePatientRequest } from "../mappers/recordMappers";

// The portal sends what the frontend types describe: a lowercase request type
// and a separate date and clock time. The instant is assembled here.
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
