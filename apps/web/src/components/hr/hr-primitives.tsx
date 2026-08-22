"use client";

import type { LucideIcon } from "lucide-react";
import { AlertCircleIcon, InboxIcon, RefreshCwIcon } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-3xl flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Metric({ label, value, detail, icon: Icon }: { label: string; value: React.ReactNode; detail?: string; icon: LucideIcon }) {
  return (
    <Card size="sm">
      <CardHeader className="grid grid-cols-[1fr_auto] gap-3 pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></span>
      </CardHeader>
      <CardContent><p className="text-2xl font-semibold tracking-[-0.04em] tabular">{value}</p>{detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}</CardContent>
    </Card>
  );
}

export function DataLoading({ rows = 5 }: { rows?: number }) {
  return <div className="flex flex-col gap-3" aria-label="Loading data">{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
}

export function DataError({ error, retry }: { error: Error; retry: () => void }) {
  const denied = error instanceof ApiError && error.status === 403;
  return (
    <Alert variant={denied ? "default" : "destructive"}>
      <AlertCircleIcon />
      <AlertTitle>{denied ? "Permission required" : "We couldn’t load this view"}</AlertTitle>
      <AlertDescription>{denied ? "Your current role does not have access to this workspace." : error.message}</AlertDescription>
      {!denied ? <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={retry}><RefreshCwIcon />Try again</Button> : null}
    </Alert>
  );
}

export function DataEmpty({ title, description, action, icon: Icon = InboxIcon }: { title: string; description: string; action?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <Empty className="min-h-64 border">
      <EmptyHeader><EmptyMedia variant="icon"><Icon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const normalized = (status || "UNKNOWN").toUpperCase();
  const success = ["ACTIVE", "APPROVED", "PRESENT", "FINALIZED", "CLOCKED_IN", "CALCULATED"].includes(normalized);
  const warning = ["PENDING", "INCOMPLETE", "PENDING_CORRECTION", "REVIEWED", "DRAFT", "ON_BREAK"].includes(normalized);
  const destructive = ["REJECTED", "ABSENT", "FAILED", "CANCELLED", "DEACTIVATED"].includes(normalized);
  const leave = ["LEAVE", "HOLIDAY", "WEEK_OFF"].includes(normalized);
  return <Badge variant={success ? "success" : warning ? "warning" : destructive ? "destructive" : leave ? "leave" : "outline"}><span aria-hidden className="size-1.5 rounded-full bg-current" />{normalized.replaceAll("_", " ")}</Badge>;
}
