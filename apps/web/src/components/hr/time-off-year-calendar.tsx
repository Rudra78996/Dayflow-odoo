"use client";

import { CalendarDaysIcon } from "lucide-react";
import type { Holiday, LeaveRequest } from "@/lib/hr-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekDays = ["S", "M", "T", "W", "T", "F", "S"];
const requestPriority = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function requestForDate(requests: LeaveRequest[], day: string) {
  return requests
    .filter((request) => dateOnly(request.startDate) <= day && dateOnly(request.endDate) >= day)
    .sort((a, b) => requestPriority.indexOf(a.status) - requestPriority.indexOf(b.status))[0];
}

function MiniMonth({ year, month, requests, holidays }: { year: number; month: number; requests: LeaveRequest[]; holidays: Holiday[] }) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const cells = Array.from({ length: firstWeekday + days }, (_, index) => index - firstWeekday + 1);

  return (
    <section aria-labelledby={`month-${year}-${month}`} className="rounded-lg bg-muted/45 p-3">
      <h3 id={`month-${year}-${month}`} className="mb-3 text-sm font-semibold tracking-tight">{monthNames[month]}</h3>
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {weekDays.map((weekday, index) => <span key={`${weekday}-${index}`} className="text-center text-[10px] font-medium text-muted-foreground">{weekday}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day < 1) return <span key={`empty-${index}`} aria-hidden className="aspect-square" />;
          const value = isoDate(year, month, day);
          const request = requestForDate(requests, value);
          const holiday = holidays.find((item) => dateOnly(item.date) === value);
          const status = request?.status.toUpperCase();
          const detail = [
            `${monthNames[month]} ${day}, ${year}`,
            request ? `${request.leaveType.name}: ${request.status.toLowerCase()}` : null,
            holiday ? `${holiday.name}${holiday.optional ? ", optional holiday" : ", company holiday"}` : null,
          ].filter(Boolean).join(". ");
          return (
            <span
              key={value}
              title={detail}
              aria-label={detail}
              className={cn(
                "relative flex aspect-square min-h-7 items-center justify-center rounded-md text-[11px] font-medium tabular transition-colors",
                !request && !holiday && "text-foreground hover:bg-background",
                holiday && "bg-warning/14 text-warning-foreground",
                status === "APPROVED" && "bg-success/15 text-success-foreground ring-1 ring-success/25",
                status === "PENDING" && "bg-leave/14 text-leave-foreground ring-1 ring-leave/30",
                status === "REJECTED" && "bg-destructive/10 text-destructive line-through",
                status === "CANCELLED" && "bg-secondary text-muted-foreground line-through",
                value === todayIso && "ring-2 ring-ring ring-offset-1 ring-offset-muted",
              )}
            >
              {day}
              {holiday && request ? <span aria-hidden className="absolute right-0.5 top-0.5 size-1 rounded-full bg-warning" /> : null}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function LegendMarker({ kind }: { kind: "approved" | "pending" | "rejected" | "holiday" | "today" }) {
  return <span aria-hidden className={cn(
    "size-3 rounded-sm",
    kind === "approved" && "bg-success/20 ring-1 ring-success/30",
    kind === "pending" && "bg-leave/15 ring-1 ring-leave/35",
    kind === "rejected" && "bg-destructive/12 ring-1 ring-destructive/25",
    kind === "holiday" && "bg-warning/20 ring-1 ring-warning/30",
    kind === "today" && "bg-background ring-2 ring-ring",
  )} />;
}

export function TimeOffYearCalendar({ year, requests, holidays }: { year: number; requests: LeaveRequest[]; holidays: Holiday[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarDaysIcon className="size-4" />{year} leave calendar</CardTitle>
        <CardDescription>Approved, pending and rejected requests are shown alongside the holidays that apply to your work location.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {monthNames.map((_, month) => <MiniMonth key={month} year={year} month={month} requests={requests} holidays={holidays} />)}
        </div>
        <aside className="flex flex-col gap-6 2xl:border-l 2xl:pl-6">
          <section aria-labelledby="calendar-legend-title">
            <h3 id="calendar-legend-title" className="text-sm font-semibold">Calendar legend</h3>
            <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><LegendMarker kind="approved" />Approved leave</span>
              <span className="flex items-center gap-2"><LegendMarker kind="pending" />Pending approval</span>
              <span className="flex items-center gap-2"><LegendMarker kind="rejected" />Rejected request</span>
              <span className="flex items-center gap-2"><LegendMarker kind="holiday" />Public or optional holiday</span>
              <span className="flex items-center gap-2"><LegendMarker kind="today" />Today</span>
            </div>
          </section>
          <section aria-labelledby="holiday-list-title">
            <div className="flex items-center justify-between gap-3">
              <h3 id="holiday-list-title" className="text-sm font-semibold">Applicable holidays</h3>
              <Badge variant="secondary">{holidays.length}</Badge>
            </div>
            {holidays.length ? (
              <ol className="mt-3 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
                {holidays.map((holiday) => (
                  <li key={holiday.id} className="flex items-start justify-between gap-3 text-xs">
                    <div><p className="font-medium text-foreground">{holiday.name}</p><p className="mt-0.5 text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(`${dateOnly(holiday.date)}T00:00:00`))}</p></div>
                    <Badge variant={holiday.optional ? "outline" : "warning"}>{holiday.optional ? "Optional" : "Holiday"}</Badge>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-xs text-muted-foreground">No holidays are configured for this year and location.</p>}
          </section>
        </aside>
      </CardContent>
    </Card>
  );
}
