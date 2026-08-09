import type { Role } from "./types";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  MessageSquare,
  Inbox,
  CalendarCheck,
  Clock,
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
    { label: "Message Log", href: "/messages", icon: MessageSquare },
    { label: "Pending Requests", href: "/requests", icon: Inbox },
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
