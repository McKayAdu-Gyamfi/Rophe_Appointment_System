import type { Role } from "./types";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Activity, // For Actions
  FileText, // For Templates
  BarChart, // For Reports
  Settings, // For Settings
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
    { label: "Appointments", href: "/appointments", icon: CalendarDays },
    { label: "Patients", href: "/patients", icon: Users },
    { label: "Actions", href: "/actions", icon: Activity },
    { label: "Templates", href: "/templates", icon: FileText },
    { label: "Reports", href: "/reports", icon: BarChart },
    { label: "Settings", href: "/settings", icon: Settings },
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
