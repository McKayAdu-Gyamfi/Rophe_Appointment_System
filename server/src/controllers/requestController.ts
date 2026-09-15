import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/httpError";
import { messageProvider } from "../services/messageProvider";
import { sendMessage } from "../services/messaging";
import { revokePortalTokens } from "../services/portal";
import { toTimeKey } from "../mappers/datetime";
import {
  assertInsideAvailability,
  assertNoOverlap,
  windowsForDate,
} from "../services/scheduling";
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

    if (status === "CONFIRMED") {
      if (pr.requestType === "RESCHEDULE" && pr.requestedStartsAt) {
        // The patient asked for a time; nobody promised it was free. Front
        // desk agreeing does not make the doctor available, so a confirmed
        // reschedule goes through exactly the checks a staff booking does —
        // otherwise this endpoint is the hole in #10's rules.
        const { doctorId, durationMinutes } = pr.appointment;

        assertInsideAvailability(
          await windowsForDate(tx, doctorId, pr.requestedStartsAt),
          toTimeKey(pr.requestedStartsAt),
          durationMinutes,
        );
        await assertNoOverlap(
          tx,
          doctorId,
          pr.requestedStartsAt,
          durationMinutes,
          pr.appointmentId,
        );

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

    return { updatedPr, pr };
  });

  const { updatedPr, pr } = patientRequest;

  // Outside the transaction: the decision is made either way, and a provider
  // outage must not roll back an appointment the patient has been moved to.
  if (status === "CONFIRMED" && pr.requestType === "RESCHEDULE") {
    // A confirmed reschedule is a new confirmed time, so it goes out through
    // the clinic's own confirmation wording — rendered, logged, and carrying a
    // fresh portal link for the new date.
    await sendMessage({
      patientId: pr.appointment.patientId,
      appointmentId: pr.appointmentId,
      type: "CONFIRMATION",
    }).catch((error) => {
      console.error("[requests] Confirmation message failed", error);
    });
  } else {
    // A declined request and a confirmed cancellation both still have to reach
    // the patient — a silent decline leaves someone expecting an answer. There
    // is no MessageType for "we answered your request", so this goes straight
    // to the provider and is NOT in the message log. Giving the clinic control
    // of this wording needs a new template type and a migration; raised rather
    // than invented here.
    const body =
      status === "CONFIRMED"
        ? "Your appointment has been cancelled as requested."
        : "The clinic could not action your appointment request. Please call us.";

    void messageProvider
      .send({
        channel: pr.appointment.patient.preferredChannel,
        to:
          pr.appointment.patient.preferredChannel === "EMAIL"
            ? pr.appointment.patient.email || pr.appointment.patient.phone
            : pr.appointment.patient.phone,
        body,
        subject: "Appointment update",
      })
      .catch((error) => {
        console.error("[requests] Decision message failed", error);
      });
  }

  // A cancelled visit's link is a credential for something not happening.
  if (status === "CONFIRMED" && pr.requestType === "CANCELLATION") {
    await revokePortalTokens(pr.appointmentId);
  }

  res.json(toWirePatientRequest(updatedPr));
}
