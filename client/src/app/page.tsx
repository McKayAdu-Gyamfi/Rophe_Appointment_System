"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Users,
  CalendarX2,
  FileText,
  BriefcaseMedical,
  TriangleAlert,
  ArrowRight,
} from "lucide-react";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useRole();

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (role === "doctor") router.replace("/doctor");
    
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [role, router]);

  const dateStr = now?.toLocaleDateString("en-US", { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now?.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full flex-col px-8 pt-5 pb-6 overflow-hidden bg-brand-bg">
      <div className="shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Staff Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1 font-bold">
          {now ? `${dateStr} ${timeStr}` : "\u00A0"}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8 shrink-0">
        <StatCard
          label="TOTAL PATIENTS TODAY"
          value="142"
          badge="+12%"
          badgeColor="bg-blue-100 text-blue-700"
          icon={<Users className="h-5 w-5 text-brand-accent" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="MISSED APPOINTMENTS"
          value="3"
          suffix=" / 12"
          icon={<CalendarX2 className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
        />
        <StatCard
          label="PENDING REPORTS"
          value="24"
          icon={<FileText className="h-5 w-5 text-brand-accent" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="TODAY'S APPOINTMENTS"
          value="12"
          icon={<BriefcaseMedical className="h-5 w-5 text-brand-accent" />}
          iconBg="bg-blue-50"
        />
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Column: Needs Action */}
        <div className="flex w-[400px] flex-col overflow-hidden gap-4">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-slate-800">Needs Action</h2>
            <button className="text-sm font-semibold text-brand-accent hover:underline">
              View All
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden gap-4">
            <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-sm border border-slate-100 p-4">
              <div className="flex items-start gap-3 mb-4 pb-4 border-b border-slate-100 shrink-0">
                <TriangleAlert className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Missed Visits</h3>
                  <p className="text-xs text-slate-500">
                    Patients requiring immediate follow-up.
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                <MissedVisit
                  initials="JA"
                  name="James Arthur"
                  details="Cardiology Follow-up • 09:00 AM"
                />
                <MissedVisit
                  initials="SM"
                  name="Sarah Mensah"
                  details="General Checkup • 10:30 AM"
                />
                <MissedVisit
                  initials="KO"
                  name="Kwame Osei"
                  details="Neurology Consult • 11:15 AM"
                />
              </div>
            </div>

            <div className="relative shrink-0 overflow-hidden rounded-2xl bg-[#004282] p-5 flex flex-col justify-end">
              <h3 className="text-lg font-bold text-white mb-1">Weekly Briefing</h3>
              <p className="text-xs text-slate-300 mb-3">
                Review updated protocols for patient intake.
              </p>
              <button className="self-start flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-slate-100">
                Read Brief
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Schedule */}
        <div className="flex flex-1 flex-col overflow-hidden gap-4">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-slate-800">Today&apos;s Schedule</h2>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
                Timeline
              </button>
              <button className="rounded-md px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                List
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rounded-2xl bg-white shadow-sm border border-slate-100 p-6 relative">
            <div className="flex flex-col gap-6 relative z-10 min-h-full">
              <div className="absolute top-2 bottom-[-24px] left-[64px] w-px bg-slate-200 -z-10" />
              <ScheduleItem
                time="13:00"
                duration="45m"
                title="Initial Consultation"
                status="In Progress"
                statusBg="bg-blue-100 text-blue-700"
                doctor="Dr. Mensah"
                room="Room 2A"
                patientInitials="ED"
                patientName="Emmanuel Darko"
                initialsBg="bg-red-100 text-red-600"
                active
              />
              <ScheduleItem
                time="14:00"
                duration="30m"
                title="Follow-up Assessment"
                status="Upcoming"
                statusBg="bg-slate-100 text-slate-600"
                doctor="Nurse Boateng"
                room="Room 4B"
                patientInitials="AA"
                patientName="Abigail Appiah"
                initialsBg="bg-blue-100 text-blue-600"
              />
              <ScheduleItem
                time="15:30"
                duration="60m"
                title="Specialist Review"
                status="Upcoming"
                statusBg="bg-slate-100 text-slate-600"
                doctor="Dr. Mensah"
                room="Room 1C"
                patientInitials="FK"
                patientName="Felix Kumi"
                initialsBg="bg-blue-100 text-blue-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
  badgeColor,
  icon,
  iconBg,
  suffix,
}: {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  iconBg: string;
  suffix?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-col justify-between h-32">
      <div className="flex justify-between items-start z-10 relative">
        <p className="text-[10px] font-bold text-slate-500 tracking-wider max-w-[60%]">
          {label}
        </p>
      </div>
      <div className="flex items-end gap-3 z-10 relative mt-4">
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-slate-900 leading-none">{value}</span>
          {suffix && (
            <span className="text-sm font-semibold text-slate-400 ml-1 mb-0.5">
              {suffix}
            </span>
          )}
        </div>
        {badge && (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide mb-1",
              badgeColor
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Circle Icon decoration */}
      <div
        className={cn(
          "absolute right-0 top-0 h-16 w-20 rounded-bl-[2.5rem] flex items-center justify-center pl-2 pb-2",
          iconBg
        )}
      >
        {icon}
      </div>
    </div>
  );
}

function MissedVisit({
  initials,
  name,
  details,
}: {
  initials: string;
  name: string;
  details: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {initials}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">{name}</p>
        <p className="text-xs text-slate-500">{details}</p>
      </div>
    </div>
  );
}

function ScheduleItem({
  time,
  duration,
  title,
  status,
  statusBg,
  doctor,
  room,
  patientInitials,
  patientName,
  initialsBg,
  active = false,
}: {
  time: string;
  duration: string;
  title: string;
  status: string;
  statusBg: string;
  doctor: string;
  room: string;
  patientInitials: string;
  patientName: string;
  initialsBg: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex w-14 shrink-0 flex-col items-end pt-1 relative">
        <span className="text-sm font-bold text-slate-800">{time}</span>
        <span className="text-[10px] font-bold text-slate-400">{duration}</span>
        <div
          className={cn(
            "absolute top-1.5 -right-[13px] h-2.5 w-2.5 rounded-full ring-4 ring-white z-20",
            active ? "bg-brand-accent" : "bg-slate-300"
          )}
        />
      </div>

      <div
        className={cn(
          "flex-1 rounded-2xl p-5 shadow-sm",
          active ? "bg-white border-2 border-brand-accent shadow-brand-accent/20" : "bg-slate-50 border border-slate-100"
        )}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              {doctor} • {room}
            </p>
          </div>
          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide", statusBg)}>
            {status}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", initialsBg)}>
            {patientInitials}
          </div>
          <span className="text-sm font-semibold text-slate-700">{patientName}</span>
        </div>
      </div>
    </div>
  );
}
