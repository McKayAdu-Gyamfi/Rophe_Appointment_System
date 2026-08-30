"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  Lock,
  MailPlus,
  RotateCw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  getStaffUsers,
  resendStaffInvitation,
  revokeStaffInvitation,
} from "@/lib/api";
import type { StaffRole, StaffSession } from "@/lib/types";
import { fmtRelative, initials } from "@/lib/format";
import { useAuth } from "@/lib/role-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { InviteStaffDialog } from "@/components/staff/invite-staff-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Staff accounts.
//
// Front desk adds the person; the person sets their own password. That split
// is the clinic's requirement and also the only sane version of it — any flow
// where a colleague picks your password ends with the password being read out
// across a desk, and with no way to tell afterwards who actually signed in.
//
// So this screen never shows, sets, or transports a password. It creates an
// account in the `invited` state and hands back a one-time link. The prototype
// puts that link on screen to copy because nothing here can send email; in
// Phase 3 the same call sends it and the link is never displayed at all.
//
// The page title lives in the top bar (see PAGE_META in lib/nav.ts).
// ---------------------------------------------------------------------------

/** The invite link the joiner opens. Absolute, so it survives being pasted. */
function inviteUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite/${token}`;
}

export default function StaffPage() {
  const { session, role } = useAuth();
  // Adding a colleague is an administrative act, not a clinical one. Doctors
  // see their own account and nothing else to press.
  const canManage = role === "front-desk";

  const [staff, setStaff] = useState<StaffSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** token → the account it belongs to, for links generated this session. */
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStaff(await getStaffUsers());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const users = await getStaffUsers();
      if (!active) return;
      setStaff(users);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const { active, invited } = useMemo(
    () => ({
      active: staff.filter((u) => u.status === "active"),
      invited: staff.filter((u) => u.status === "invited"),
    }),
    [staff],
  );

  const doctorCount = useMemo(
    () => active.filter((u) => u.role === "doctor").length,
    [active],
  );

  const copyLink = useCallback(async (id: string, token: string) => {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
      toast.success("Invite link copied", { description: url });
    } catch {
      // Clipboard is blocked in some browsers without a user gesture chain;
      // the link is on screen anyway, so this is not a failure worth a red toast.
      toast.info("Copy the link from the row", { description: url });
    }
  }, []);

  const handleInvited = useCallback(
    async (user: StaffSession, token: string) => {
      setLinks((prev) => ({ ...prev, [user.id]: token }));
      await refresh();
      setDialogOpen(false);
      toast.success(`Invitation created for ${user.fullName}`, {
        description: "Copy the link and send it to them — they choose their own password.",
      });
    },
    [refresh],
  );

  const handleResend = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const result = await resendStaffInvitation(id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setLinks((prev) => ({ ...prev, [id]: result.inviteToken }));
        await refresh();
        toast.success("New link issued", { description: "The previous link no longer works." });
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const handleRevoke = useCallback(
    async (user: StaffSession) => {
      setBusyId(user.id);
      try {
        const result = await revokeStaffInvitation(user.id);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't withdraw that invitation.");
          return;
        }
        setLinks((prev) => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
        await refresh();
        toast.success(`Invitation to ${user.fullName} withdrawn`);
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4 rounded-surface bg-slate-100 p-4 sm:p-5">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-24 rounded-xl bg-slate-200" />
          <div className="h-72 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-surface bg-slate-100 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="max-w-xl">
              You set up the account and the email address; the new joiner chooses their own
              password from the link. Nobody here ever sees or sets a colleague&rsquo;s password.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <MailPlus className="h-4 w-4" />
              Invite staff
            </button>
          )}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Active accounts"
            value={String(active.length)}
            icon={UsersRound}
            note={`${active.length - doctorCount} front desk · ${doctorCount} doctor${doctorCount === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Pending invitations"
            value={String(invited.length)}
            icon={MailPlus}
            tone={invited.length > 0 ? "alert" : "accent"}
            note={
              invited.length === 0 ? "Everyone has signed in" : "Waiting on a password to be set"
            }
          />
          <StatCard
            label="Doctors"
            value={String(doctorCount)}
            icon={Stethoscope}
            note="Each has their own schedule and availability"
          />
        </div>

        {/* Pending invitations first — they are the only rows with work on them. */}
        {invited.length > 0 && (
          <section className="mb-5 overflow-hidden rounded-panel bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <MailPlus className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Pending invitations</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {invited.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-200">
              {invited.map((user) => (
                <li key={user.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StaffIdentity user={user} tone="pending" />

                    <div className="flex shrink-0 items-center gap-1.5">
                      {canManage && (
                        <>
                          {links[user.id] && (
                            <button
                              type="button"
                              onClick={() => void copyLink(user.id, links[user.id])}
                              className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-200"
                            >
                              {copied === user.id ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copied === user.id ? "Copied" : "Copy link"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleResend(user.id)}
                            disabled={busyId === user.id}
                            title="Issue a new link and invalidate the old one"
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                          >
                            {busyId === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5" />
                            )}
                            {links[user.id] ? "New link" : "Get link"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(user)}
                            disabled={busyId === user.id}
                            aria-label={`Withdraw the invitation to ${user.fullName}`}
                            title="Withdraw invitation"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* The link itself, once generated. Shown in full because in
                      the prototype there is no email to carry it. */}
                  {links[user.id] && (
                    <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">
                      <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="min-w-0 break-all font-mono">
                        {inviteUrl(links[user.id])}
                      </span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="overflow-hidden rounded-panel bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Active accounts</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {active.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-200">
            {active.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <StaffIdentity user={user} tone="active" isYou={user.id === session?.id} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Mounted only while open, so the form starts clean every time rather
          than being reset by an effect. */}
      {dialogOpen && (
        <InviteStaffDialog
          open
          invitedBy={session?.fullName ?? "Front desk"}
          onClose={() => setDialogOpen(false)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
}

// --- sub-components -------------------------------------------------------

function StaffIdentity({
  user,
  tone,
  isYou = false,
}: {
  user: StaffSession;
  tone: "active" | "pending";
  isYou?: boolean;
}) {
  const pending = tone === "pending";

  return (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          pending ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-700",
        )}
      >
        {initials(user.fullName)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="truncate">{user.fullName}</span>
          {isYou && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              You
            </span>
          )}
        </p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
        <p className="truncate text-[11px] text-slate-400">
          {user.jobTitle} · {user.staffId}
          {pending && user.invitedBy
            ? ` · invited by ${user.invitedBy}${user.invitedAt ? ` ${fmtRelative(user.invitedAt)}` : ""}`
            : ""}
        </p>
      </div>

      <RolePill role={user.role} />

      <span
        className={cn(
          "inline-flex w-28 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          pending ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", pending ? "bg-amber-500" : "bg-teal-600")} />
        {pending ? "Invited" : "Active"}
      </span>
    </>
  );
}

function RolePill({ role }: { role: StaffRole }) {
  const doctor = role === "doctor";
  const Icon = doctor ? Stethoscope : UserRound;
  return (
    <span className="hidden w-32 shrink-0 items-center gap-1.5 text-xs text-slate-600 sm:inline-flex">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {doctor ? "Doctor" : "Front desk"}
    </span>
  );
}
