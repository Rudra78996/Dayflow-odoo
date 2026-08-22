"use client";

import Link from "next/link";
import { ArrowUpRightIcon, CalendarClockIcon, Clock3Icon, ReceiptTextIcon, UmbrellaIcon, UsersRoundIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatTime, type DashboardSummary } from "@/lib/hr-api";
import { useApiResource } from "@/hooks/use-api-resource";
import { DataError, DataLoading, Metric, PageHeading, StatusBadge } from "@/components/hr/hr-primitives";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const quickActions = [
  { title: "My attendance", description: "Clock your day and review work time.", href: "/attendance", icon: Clock3Icon },
  { title: "Time off", description: "Check balances, calendar, and requests.", href: "/time-off", icon: UmbrellaIcon },
  { title: "People directory", description: "Find workplace details across your team.", href: "/employees", icon: UsersRoundIcon },
];

export function DashboardScreen() {
  const resource = useApiResource(() => apiFetch<DashboardSummary>("/dashboard"), []);
  return <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8"><PageHeading eyebrow="Overview" title="Your workday, clearly organized" description="Attendance, time off, people, and payroll stay connected through one calm workspace." />{resource.loading ? <DataLoading rows={7} /> : resource.error ? <DataError error={resource.error} retry={resource.refresh} /> : <><Card className="overflow-hidden border-primary/10 bg-primary text-primary-foreground"><CardHeader><CardTitle className="text-primary-foreground">Today’s status</CardTitle><CardDescription className="text-primary-foreground/65">Server-authoritative clock state for your current workday.</CardDescription></CardHeader><CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-3xl font-semibold tracking-[-0.04em]">{resource.data?.clock?.state?.replaceAll("_", " ") || "No clock state yet"}</h2><StatusBadge status={resource.data?.clock?.state} /></div><p className="mt-2 text-sm text-primary-foreground/65">{resource.data?.clock?.since ? `Active since ${formatTime(resource.data.clock.since)}` : "Open attendance to begin or review your workday."}</p></div><Link href="/attendance" className={cn(buttonVariants({ variant: "secondary" }))}>Open attendance<ArrowUpRightIcon /></Link></CardContent></Card><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Team members" value={resource.data?.team?.employeeCount ?? "—"} detail="Visible to people operators" icon={UsersRoundIcon} /><Metric label="Leave balance" value={resource.data?.leaveBalances?.reduce((total, balance) => total + balance.units, 0) ?? "—"} detail="Available ledger units" icon={CalendarClockIcon} /><Metric label="Pending leave" value={resource.data?.team?.pendingLeave ?? "—"} detail="Awaiting decision" icon={UmbrellaIcon} /><Metric label="Open payroll runs" value={resource.data?.payroll?.openRuns ?? "—"} detail="Restricted to Admin" icon={ReceiptTextIcon} /></div><section><div className="mb-4"><h2 className="text-lg font-semibold tracking-tight">Quick access</h2><p className="text-sm text-muted-foreground">Continue a primary workflow without hunting through menus.</p></div><div className="grid gap-4 lg:grid-cols-3">{quickActions.map((item) => <Card key={item.href} className="transition-transform hover:-translate-y-0.5"><CardHeader><span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><item.icon className="size-4" /></span><CardTitle>{item.title}</CardTitle><CardDescription>{item.description}</CardDescription><CardAction><ArrowUpRightIcon className="size-4 text-muted-foreground" /></CardAction></CardHeader><CardContent><Link href={item.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>Open</Link></CardContent></Card>)}</div></section></>}</main>;
}
