"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { acceptStaffInvitation, getStaffInvitation, MIN_PASSWORD_LENGTH } from "@/lib/api";
import type { StaffSession } from "@/lib/types";
import { CLINIC } from "@/lib/clinic";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Accept a staff invitation.
//
// The other half of the flow front desk starts on /staff: they created the
// account and the email address, and this is where the new joiner chooses the
// password — the only place in the app that can set one.
//
// Public by design (see PUBLIC_PREFIXES in app-shell): the person opening it
// has no account to sign in with yet. The token in the URL is the only thing
// standing in for identity, which is exactly why the real one must be signed
// and short-lived; the prototype's is neither, and says so.
//
// Renders without app chrome, like /login — there is no navigation to offer
// someone who is not yet a member of staff.
// ---------------------------------------------------------------------------

type Stage = "loading" | "invalid" | "form" | "done";

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [invitee, setInvitee] = useState<StaffSession | undefined>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getStaffInvitation(token);
      if (!active) return;
      setInvitee(user);
      setStage(user ? "form" : "invalid");
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await acceptStaffInvitation(token, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Deliberately not signing them in. Their first act should be a real
      // sign-in with the password they just chose — it proves the credentials
      // work while they are still at the desk, rather than at 7am on a Monday.
      setStage("done");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src={CLINIC.logo}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">{CLINIC.name}</h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {stage === "loading" && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your invitation…
            </p>
          )}

          {stage === "invalid" && (
            <div className="py-4 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Lock className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                This link is no longer valid
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Invitation links can only be used once, and a new link replaces any earlier one.
                Ask the front desk to send you a fresh invitation.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Go to sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {stage === "done" && invitee && (
            <div className="py-4 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Your account is ready</h2>
              <p className="mt-2 text-sm text-slate-500">
                Sign in with <span className="font-medium text-slate-700">{invitee.email}</span> and
                the password you just chose.
              </p>
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {stage === "form" && invitee && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">
                Welcome, {invitee.fullName.split(" ")[0]}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {invitee.invitedBy ? `${invitee.invitedBy} set up` : "The clinic has set up"} your
                account. Choose a password to finish.
              </p>

              {/* What they are accepting. Shown read-only: the account details
                  were agreed with the clinic, and letting someone edit their
                  own role on the way in would defeat the point of the flow. */}
              <dl className="mt-4 space-y-2 rounded-xl bg-slate-100 px-3.5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Sign in as</dt>
                  <dd className="min-w-0 truncate font-medium text-slate-900">{invitee.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="flex shrink-0 items-center gap-1.5 font-medium text-slate-900">
                    {invitee.role === "doctor" ? (
                      <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <UserRound className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    {invitee.role === "doctor" ? "Doctor" : "Front desk"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Staff ID</dt>
                  <dd className="shrink-0 font-mono text-xs text-slate-600">{invitee.staffId}</dd>
                </div>
              </dl>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="invite-password"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Choose a password
                  </label>
                  <div className="relative">
                    <input
                      id="invite-password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      autoFocus
                      aria-describedby="invite-password-hint"
                      className="w-full rounded-lg bg-slate-100 py-2.5 pl-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-brand-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p
                    id="invite-password-hint"
                    className={cn(
                      "mt-1.5 text-xs",
                      tooShort ? "text-rose-600" : "text-slate-500",
                    )}
                  >
                    At least {MIN_PASSWORD_LENGTH} characters. Nobody at the clinic can see it.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="invite-confirm"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Confirm password
                  </label>
                  <input
                    id="invite-confirm"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className={cn(
                      "w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm outline-none transition focus:ring-2",
                      mismatch ? "ring-2 ring-rose-400" : "focus:ring-brand-600",
                    )}
                  />
                  {mismatch && (
                    <p className="mt-1.5 text-xs text-rose-600">
                      These don&rsquo;t match yet.
                    </p>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting || password.length < MIN_PASSWORD_LENGTH || password !== confirm
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Set password and activate
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Not expecting this? Call the clinic on{" "}
          <a href={`tel:${CLINIC.phoneDial}`} className="font-medium text-brand-600">
            {CLINIC.phone}
          </a>
        </p>
      </div>
    </div>
  );
}
