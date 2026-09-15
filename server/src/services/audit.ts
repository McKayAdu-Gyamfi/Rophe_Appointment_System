import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Who changed what.
//
// Written for the changes somebody might later need to account for: a visit
// marked attended, a colleague's account created or revoked, the wording that
// goes out to patients, and the hours the clinic says it is open. Each of
// those is a claim about the real world that a person made, and "the system
// says so" is not an answer when the clinic is asked who decided.
//
// Deliberately not written for reads, or for the ordinary churn of booking —
// an audit log nobody can scan is the same as no audit log.
//
// Failures here never fail the request they describe. An audit row is evidence
// about work that already happened; losing one must not undo the work.
// ---------------------------------------------------------------------------

export type AuditAction =
  | "appointment.status_changed"
  | "staff.invited"
  | "staff.invitation_resent"
  | "staff.invitation_revoked"
  | "staff.activated"
  | "template.updated"
  | "template.reverted"
  | "availability.day_replaced"
  | "availability.exception_added"
  | "availability.exception_removed";

export interface AuditEntry {
  /** Absent for the unauthenticated paths — a joiner activating their account. */
  actorUserId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}

/** Fire-and-forget. Never awaited by a request that has already succeeded. */
export function recordAudit(entry: AuditEntry): void {
  void prisma.auditLog
    .create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: entry.meta,
      },
    })
    .catch((error) => {
      console.error(`[audit] Failed to record ${entry.action} on ${entity(entry)}`, error);
    });
}

function entity(entry: AuditEntry): string {
  return `${entry.entity}:${entry.entityId}`;
}
