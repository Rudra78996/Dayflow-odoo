import { CalendarDaysIcon, Clock3Icon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function WorkdayRail() {
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <section className="overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
      <div className="grid min-h-28 gap-6 px-5 py-5 md:grid-cols-[1.15fr_1fr_auto] md:items-center md:px-7">
        <div>
          <Badge className="mb-3 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">Workspace active</Badge>
          <h2 className="text-xl font-semibold tracking-tight">Good to see you.</h2>
          <p className="mt-1 text-sm text-primary-foreground/65">Your team directory and employee records are ready.</p>
        </div>
        <div className="grid grid-cols-2 gap-5 border-primary-foreground/15 md:border-l md:pl-7">
          <div><CalendarDaysIcon className="mb-2 size-4 opacity-60" /><p className="text-xs uppercase tracking-wider opacity-60">Today</p><p className="mt-1 text-sm font-medium">{today}</p></div>
          <div><Clock3Icon className="mb-2 size-4 opacity-60" /><p className="text-xs uppercase tracking-wider opacity-60">Attendance</p><p className="mt-1 text-sm font-medium">Coming in phase 7</p></div>
        </div>
        <SparklesIcon className="hidden size-8 opacity-30 md:block" />
      </div>
    </section>
  );
}
