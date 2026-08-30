"use client";

import { useEffect, useState } from "react";
import { Loader2, MailPlus, Stethoscope, UserRound, X } from "lucide-react";
import { inviteStaffUser } from "@/lib/api";
import type { StaffRole, StaffSession } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Invite a colleague.
//
// Four fields and no password field — that absence is the feature. Front desk
// supplies who the person is and what they may do; the account is created
// unusable until the joiner sets their own credentials from the link.
//
// Role is a two-way choice rather than a dropdown because it is the one field
// with consequences: it decides which navigation the person lands in, and a
// doctor invitation also creates the Doctor record their schedule hangs off.
// A choice like that should be visible, not folded into a select.
// ---------------------------------------------------------------------------

const ROLES: { value: StaffRole; label: string; hint: string; icon: typeof UserRound }[] = [
  {
    value: "front-desk",
    label: "Front desk",
    hint: "Books appointments, manages patients, sends messages",
    icon: UserRound,
  },
  {
    value: "doctor",
    label: "Doctor",
    hint: "Own schedule and availability; read-only patient history",
    icon: Stethoscope,
  },
];

const DEFAULT_TITLE: Record<StaffRole, string> = {
  "front-desk": "Front-desk Staff",
  doctor: "Specialist Physician",
};

export function InviteStaffDialog({
  open,
  invitedBy,
  onClose,
  onInvited,
}: {
  open: boolean;
  invitedBy: string;
  onClose: () => void;
  onInvited: (user: StaffSession, inviteToken: string) => void | Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("front-desk");
  const [specialty, setSpecialty] = useState("");
  /**
   * Null until the field is edited. The title then *derives* from the role
   * rather than being copied into state and re-synced, so switching role
   * updates the default without an effect and without clobbering a title
   * someone has already typed.
   */
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const jobTitle = titleOverride ?? DEFAULT_TITLE[role];
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The parent mounts this only while open, so every open starts on fresh
  // state — no reset needed, and a withdrawn invite never leaves its details
  // sitting in the form for the next person.

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await inviteStaffUser({
        fullName,
        email,
        role,
        jobTitle,
        specialty: role === "doctor" ? specialty : undefined,
        invitedBy,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onInvited(result.user, result.inviteToken);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-staff-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="invite-staff-title"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <MailPlus className="h-4 w-4 text-teal-700" />
              Invite a staff member
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              They will get a link to set their own password. You never choose it for them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Full name
            </label>
            <input
              id="invite-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoFocus
              placeholder="Ama Boadu"
              className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="invite-email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Work email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ama.boadu@rophe.care"
              className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-teal-600"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              This is the address they will sign in with.
            </p>
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-slate-700">Role</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((option) => {
                const selected = role === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-xl px-3.5 py-3 text-left transition",
                      selected
                        ? "bg-teal-50 ring-2 ring-teal-600"
                        : "bg-slate-100 hover:bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-2 text-sm font-semibold",
                        selected ? "text-teal-900" : "text-slate-700",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-[11px]",
                        selected ? "text-teal-700" : "text-slate-500",
                      )}
                    >
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="invite-title"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Job title
              </label>
              <input
                id="invite-title"
                value={jobTitle}
                onChange={(e) => setTitleOverride(e.target.value)}
                className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {role === "doctor" && (
              <div>
                <label
                  htmlFor="invite-specialty"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Specialty
                </label>
                <input
                  id="invite-specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Dietician, Urologist…"
                  className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-teal-600"
                />
              </div>
            )}
          </div>

          {role === "doctor" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              A doctor account also creates their schedule and availability. Note that booking
              still runs against a single doctor in this prototype — see the PRD&rsquo;s open
              questions on multi-doctor scheduling.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MailPlus className="h-4 w-4" />
              )}
              Create invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
