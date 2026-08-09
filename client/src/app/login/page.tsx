"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getStaffUsers } from "@/lib/api";
import { DEMO_PASSWORD } from "@/lib/mockData";
import type { StaffSession } from "@/lib/types";
import { CLINIC } from "@/lib/clinic";
import { LANDING_BY_ROLE } from "@/lib/nav";
import { useAuth } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { session, ready, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<StaffSession[]>([]);

  // Already signed in? Don't sit on the login screen.
  useEffect(() => {
    if (ready && session) router.replace(LANDING_BY_ROLE[session.role]);
  }, [ready, session, router]);

  useEffect(() => {
    let active = true;
    void getStaffUsers().then((users) => {
      if (active) setDemoAccounts(users);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Sign in failed.");
      return;
    }
    // Role decides the landing page; the provider has the session by now.
    const matched = demoAccounts.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    router.replace(LANDING_BY_ROLE[matched?.role ?? "front-desk"]);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-brand-50 px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        {/* Soft brand shapes */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-brand-100/70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-24 h-[22rem] w-[22rem] rounded-full bg-brand-100/50"
        />

        <div className="relative">
          <Image
            src={CLINIC.logo}
            alt={CLINIC.name}
            width={240}
            height={240}
            priority
            className="h-14 w-auto object-contain"
          />

          <h1 className="mt-16 max-w-md text-5xl font-semibold leading-[1.1] tracking-tight text-brand-900">
            Specialist care,
            <br />
            delivered with
            <br />
            excellence.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-slate-600">
            Welcome to the Staff Portal. Access patient records, manage appointments, and
            collaborate securely.
          </p>
        </div>

        <div className="relative flex w-fit items-center gap-3 rounded-2xl border border-white bg-white/80 px-4 py-3.5 shadow-sm backdrop-blur">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              Secure healthcare access
            </span>
            <span className="block text-xs text-slate-500">End-to-end encrypted protocol</span>
          </span>
        </div>
      </aside>

      {/* Sign-in panel */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo — the brand panel is hidden below lg */}
          <Image
            src={CLINIC.logo}
            alt={CLINIC.name}
            width={240}
            height={240}
            priority
            className="mb-8 h-12 w-auto object-contain lg:hidden"
          />

          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">
            Enter your credentials to access the staff portal.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address or staff ID
              </label>
              <div className="relative mt-1.5">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. dr.mensah@rophe.care"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setError("Password resets aren't part of the prototype — ask the front desk.")
                  }
                  className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Remember my device for 30 days
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-clinic-red-50 px-3.5 py-2.5 text-sm font-medium text-clinic-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in to dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts — prototype convenience, delete with the mock auth */}
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Demo accounts
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {demoAccounts.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(user.email);
                      setPassword(DEMO_PASSWORD);
                      setError(null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition",
                      "hover:bg-brand-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {user.fullName}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{user.email}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {user.role === "doctor" ? "Doctor" : "Front desk"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 px-2.5 text-xs text-slate-400">
              Tap an account to fill the form — password{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-600">
                {DEMO_PASSWORD}
              </code>
            </p>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
            Patients don&apos;t sign in — they open the link sent to their phone.
            <br />
            For support, call{" "}
            <a
              href={`tel:${CLINIC.phoneDial}`}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              {CLINIC.phone}
            </a>
            .
          </div>
        </div>
      </main>
    </div>
  );
}
