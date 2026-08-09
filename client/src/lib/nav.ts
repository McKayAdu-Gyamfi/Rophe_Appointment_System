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
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "My Availability", href: "/doctor/availability", icon: CalendarCheck },
    { label: "My Schedule", href: "/doctor/schedule", icon: Clock },
  ],
  // Patient role has no nav — only the single patient-facing page.
  patient: [],
};
