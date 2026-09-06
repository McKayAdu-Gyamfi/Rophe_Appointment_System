// ---------------------------------------------------------------------------
// Wire ⇄ database enum translation.
//
// The database speaks SCREAMING_SNAKE, because that is Prisma's convention.
// client/src/lib/types.ts speaks lowercase-hyphenated, and it is the published
// contract — the frontend keys objects off these values (REQUEST_STATUS_STYLES,
// REQUEST_TYPE_STYLES) and compares them as literals, so "PENDING" where
// "pending" is expected is not a cosmetic difference, it is a missing lookup.
//
// Every enum crossing the boundary goes through a codec here, in both
// directions, so neither side has to know how the other spells things. Pairs
// are declared once and inverted, which is what stops the two maps drifting.
// ---------------------------------------------------------------------------

import type {
  AppointmentStatus as DbAppointmentStatus,
  Channel as DbChannel,
  MessageType as DbMessageType,
  RequestStatus as DbRequestStatus,
  RequestType as DbRequestType,
} from "@prisma/client";
import { badRequest } from "../lib/httpError";

/** The lowercase spellings in client/src/lib/types.ts. */
export type WireChannel = "whatsapp" | "sms" | "email";
export type WireAppointmentStatus =
  | "booked"
  | "confirmed"
  | "attended"
  | "missed"
  | "rescheduled"
  | "cancelled";
export type WireMessageType =
  | "confirmation"
  | "reminder"
  | "follow-up"
  | "recall"
  | "birthday";
export type WireRequestType = "reschedule" | "cancellation";
export type WireRequestStatus = "pending" | "confirmed" | "declined";

interface Codec<Db extends string, Wire extends string> {
  /** Database value out to the client. */
  toWire(value: Db): Wire;
  /** Client value in. Throws a 400 rather than reaching Prisma as junk. */
  toDb(value: string): Db;
  /** Every accepted wire value — the single source for the zod schemas. */
  readonly wireValues: readonly [Wire, ...Wire[]];
}

function codec<Db extends string, Wire extends string>(
  label: string,
  pairs: ReadonlyArray<readonly [Db, Wire]>,
): Codec<Db, Wire> {
  const outbound = new Map<string, Wire>(pairs);
  const inbound = new Map<string, Db>(pairs.map(([db, wire]) => [wire, db]));
  const wireValues = pairs.map(([, wire]) => wire) as unknown as [Wire, ...Wire[]];

  return {
    toWire(value) {
      const mapped = outbound.get(value);
      // An unmapped value means the schema gained a variant and this table did
      // not. That is a bug in here, not bad input, so it must not be a 400.
      if (!mapped) throw new Error(`No wire spelling for ${label} "${value}".`);
      return mapped;
    },
    toDb(value) {
      const mapped = inbound.get(value);
      if (!mapped) {
        throw badRequest(`"${value}" is not a valid ${label}. Expected one of: ${wireValues.join(", ")}.`);
      }
      return mapped;
    },
    wireValues,
  };
}

export const channelCodec = codec<DbChannel, WireChannel>("channel", [
  ["WHATSAPP", "whatsapp"],
  ["SMS", "sms"],
  ["EMAIL", "email"],
]);

export const appointmentStatusCodec = codec<DbAppointmentStatus, WireAppointmentStatus>(
  "appointment status",
  [
    ["BOOKED", "booked"],
    ["CONFIRMED", "confirmed"],
    ["ATTENDED", "attended"],
    ["MISSED", "missed"],
    ["RESCHEDULED", "rescheduled"],
    ["CANCELLED", "cancelled"],
  ],
);

// FOLLOW_UP ⇄ "follow-up" is the pair that silently broke template editing:
// the frontend sends the hyphenated name in the URL and no amount of
// case-folding turns one into the other.
export const messageTypeCodec = codec<DbMessageType, WireMessageType>("message type", [
  ["CONFIRMATION", "confirmation"],
  ["REMINDER", "reminder"],
  ["FOLLOW_UP", "follow-up"],
  ["RECALL", "recall"],
  ["BIRTHDAY", "birthday"],
]);

export const requestTypeCodec = codec<DbRequestType, WireRequestType>("request type", [
  ["RESCHEDULE", "reschedule"],
  ["CANCELLATION", "cancellation"],
]);

export const requestStatusCodec = codec<DbRequestStatus, WireRequestStatus>("request status", [
  ["PENDING", "pending"],
  ["CONFIRMED", "confirmed"],
  ["DECLINED", "declined"],
]);
