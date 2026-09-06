import type { Channel, MessageType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/httpError";
import { renderTemplate } from "../lib/templates";
import { messageProvider } from "./messageProvider";
import { toDateKey, toTimeKey } from "../mappers/datetime";

// ---------------------------------------------------------------------------
// Sending a message, start to finish.
//
// Render the clinic's current wording, hand the text to the provider, then log
// what actually went out. In that order, and with the rendered text stored on
// the row rather than a pointer to the template: the clinic edits its wording,
// and a message sent last March has to keep saying what it said in March.
//
// One function because there are two callers — front desk pressing send, and
// booking confirming an appointment — and they must produce identical rows.
// ---------------------------------------------------------------------------

export interface SendInput {
  patientId: string;
  appointmentId?: string;
  type: MessageType;
  /** Front desk may force a channel; otherwise the patient's preference wins. */
  channel?: Channel;
}

/**
 * Where a message can actually be sent.
 *
 * A patient whose preferred channel is email but who has no email address is a
 * record that disagrees with itself — usually because the address was removed
 * later. Falling back beats failing to send: WhatsApp if we have a number for
 * it, otherwise SMS to the phone number, which every patient has.
 */
function resolveChannel(
  preferred: Channel,
  patient: { email: string | null; whatsappNumber: string | null },
): { channel: Channel; to: string } {
  if (preferred === "EMAIL" && patient.email) return { channel: "EMAIL", to: patient.email };
  if (preferred === "WHATSAPP" && patient.whatsappNumber) {
    return { channel: "WHATSAPP", to: patient.whatsappNumber };
  }
  return { channel: "SMS", to: "" };
}

export async function sendMessage(input: SendInput) {
  const [patient, template] = await Promise.all([
    prisma.patient.findUnique({ where: { id: input.patientId } }),
    prisma.messageTemplate.findUnique({ where: { type: input.type } }),
  ]);

  if (!patient) throw notFound("That patient could not be found.");
  if (!template) throw notFound(`There is no ${input.type} template to send.`);

  const appointment = input.appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        include: { doctor: { include: { user: true } } },
      })
    : null;

  // Only recall messages use {{last_visit}}, and only some patients have one.
  const lastVisit =
    input.type === "RECALL"
      ? await prisma.appointment.findFirst({
          where: { patientId: patient.id, status: "ATTENDED" },
          orderBy: { startsAt: "desc" },
          select: { startsAt: true },
        })
      : null;

  const body = renderTemplate(template.body, {
    patientFullName: patient.fullName,
    appointmentDate: appointment ? toDateKey(appointment.startsAt) : undefined,
    appointmentTime: appointment ? toTimeKey(appointment.startsAt) : undefined,
    doctorFullName: appointment?.doctor.user.fullName,
    lastVisitDate: lastVisit ? toDateKey(lastVisit.startsAt) : undefined,
  });

  const resolved = resolveChannel(input.channel ?? patient.preferredChannel, patient);
  const to = resolved.to || patient.phone;

  const emailSubject =
    resolved.channel === "EMAIL"
      ? renderTemplate(template.emailSubject, { patientFullName: patient.fullName })
      : null;

  // Hand it over first: a row claiming SENT for something the provider never
  // accepted is worse than no row, and the id it returns is what a delivery
  // webhook will correlate on.
  let providerMessageId: string | null = null;
  let providerError: string | null = null;
  let deliveryStatus: Prisma.MessageCreateInput["deliveryStatus"] = "SENT";

  try {
    const result = await messageProvider.send({
      channel: resolved.channel,
      to,
      body,
      subject: emailSubject ?? undefined,
    });
    providerMessageId = result.providerMessageId;
  } catch (error) {
    // The attempt still gets logged. Front desk needs to see that it failed,
    // not to be left wondering whether anything happened at all.
    deliveryStatus = "FAILED";
    providerError = error instanceof Error ? error.message : "The provider rejected it.";
  }

  return prisma.message.create({
    data: {
      patientId: patient.id,
      appointmentId: appointment?.id,
      channel: resolved.channel,
      type: input.type,
      body,
      emailSubject,
      templateVersion: template.version,
      deliveryStatus,
      providerMessageId,
      providerError,
    },
  });
}
