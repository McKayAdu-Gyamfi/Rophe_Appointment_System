import type { Role } from "./types";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  MessageSquare,
  Inbox,
  CalendarCheck,
  Clock,
  UserRoundSearch,
  UserRoundPlus,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Role → nav items, matching Section 2's access table.
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  "front-desk": [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Patients", href: "/patients", icon: Users },
    { label: "Appointments", href: "/appointments", icon: CalendarDays },
    { label: "Messages", href: "/messages", icon: MessageSquare },
    { label: "Pending Requests", href: "/requests", icon: Inbox },
    { label: "Recalls", href: "/recalls", icon: UserRoundSearch },
    { label: "Staff", href: "/staff", icon: UserRoundPlus },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor", icon: LayoutDashboard },
    { label: "My Availability", href: "/doctor/availability", icon: CalendarCheck },
    { label: "My Schedule", href: "/doctor/schedule", icon: Clock },
  ],
  // Patient role has no nav — only the single patient-facing page.
  patient: [],
};

/**
 * Where each role lands. Switching roles in the top nav routes here, so a
 * doctor never starts on the front-desk dashboard (and vice versa).
 */
export const LANDING_BY_ROLE: Record<Role, string> = {
  "front-desk": "/",
  doctor: "/doctor",
  patient: "/portal/appointment",
};

// ---------------------------------------------------------------------------
// Page titles for the top bar.
//
// The reference design carries the page title in the top bar rather than in
// the page body, so this is the single source of truth for it. Screens listed
// here must NOT also render their own <h1> — that would print the title twice.
// Sub-routes (detail, edit, new) are absent on purpose: they keep their own
// heading, because it names a record rather than a section.
// ---------------------------------------------------------------------------

export interface PageMeta {
  title: string;
  /** Dashboards greet the signed-in user where other pages show nothing. */
  greet: boolean;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "Dashboard", greet: true },
  "/doctor": { title: "Dashboard", greet: true },
  "/patients": { title: "Patients", greet: false },
  "/appointments": { title: "Appointments", greet: false },
  "/messages": { title: "Messages", greet: false },
  "/requests": { title: "Pending Requests", greet: false },
  "/recalls": { title: "Patient Recalls", greet: false },
  "/staff": { title: "Staff Accounts", greet: false },
  "/doctor/availability": { title: "My Availability", greet: false },
  "/doctor/schedule": { title: "My Schedule", greet: false },
};

/**
 * Title for the top bar. Falls back to the closest matching parent section so
 * a detail route still reads as part of its area rather than blank.
 */
export function pageMetaFor(pathname: string): PageMeta {
  const exact = PAGE_META[pathname];
  if (exact) return exact;

  const parent = Object.keys(PAGE_META)
    .filter((href) => href !== "/" && pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return parent ? { title: PAGE_META[parent].title, greet: false } : { title: "", greet: false };
}

// ---------------------------------------------------------------------------
// Top-bar quick actions.
//
// The round icon buttons beside the account menu are shortcuts into a role's
// own work, so they follow the same access table as NAV_BY_ROLE — front desk
// triages requests, a doctor edits availability. Hardcoding one destination
// for everyone sent front-desk staff to the doctor's availability screen.
// ---------------------------------------------------------------------------

export const QUICK_ACTIONS_BY_ROLE: Record<Role, NavItem[]> = {
  "front-desk": [{ label: "Pending requests", href: "/requests", icon: Bell }],
  doctor: [
    { label: "Availability settings", href: "/doctor/availability", icon: Settings },
  ],
  patient: [],
};
