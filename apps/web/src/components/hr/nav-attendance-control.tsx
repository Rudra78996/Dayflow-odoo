"use client";

import { useEffect, useState } from "react";
import {
  CheckIcon,
  Clock3Icon,
  CoffeeIcon,
  LogInIcon,
  LogOutIcon,
  PlayIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { ClockState } from "@/lib/hr-api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ClockAction = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function NavAttendanceControl() {
  const resource = useApiResource(
    () => apiFetch<ClockState>("/attendance/clock-state"),
    [],
  );
  const [pendingAction, setPendingAction] = useState<ClockAction | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (resource.data?.state !== "CLOCKED_IN") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resource.data?.serverTime, resource.data?.state]);

  async function transition(action: ClockAction) {
    setPendingAction(action);
    try {
      await apiFetch("/attendance/clock-events", {
        method: "POST",
        body: JSON.stringify({
          action,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      toast.success(
        action === "CLOCK_IN"
          ? "Checked in"
          : action === "BREAK_START"
            ? "Break started"
            : action === "CLOCK_OUT"
              ? "Checked out"
              : "Break ended",
      );
      await resource.refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Attendance action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (resource.loading) {
    return <Skeleton className="h-8 w-9 sm:w-24" />;
  }
  if (resource.error || !resource.data) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pendingAction !== null}
        title={resource.error?.message || "Attendance state is unavailable"}
        onClick={() => void transition("CLOCK_IN")}
      >
        {pendingAction === "CLOCK_IN" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <LogInIcon data-icon="inline-start" />
        )}
        Check in
      </Button>
    );
  }

  const state = resource.data.state;
  const attendanceAvailable = resource.data.attendanceAvailable !== false;
  const serverTimestamp = resource.data.serverTime
    ? new Date(resource.data.serverTime).getTime()
    : now;
  const liveSeconds =
    state === "CLOCKED_IN"
      ? Math.max(0, Math.floor((now - serverTimestamp) / 1000))
      : 0;
  const elapsed = formatDuration(
    (resource.data.workedSeconds || 0) + liveSeconds,
  );
  const availabilityLabel = resource.data.availableFrom
    ? `Starts ${new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
      }).format(new Date(resource.data.availableFrom))}`
    : "Setup needed";
  const statusLabel =
    state === "NOT_CLOCKED_IN"
      ? "Not checked in"
      : state === "CLOCKED_IN"
        ? "Working"
        : state === "ON_BREAK"
          ? "On break"
          : "Workday complete";
  const pending = pendingAction !== null;

  return (
    <div
      className={cn(
        "flex h-10 items-center gap-1 rounded-xl border bg-card p-1 shadow-[0_4px_16px_-10px_rgba(75,42,81,0.5)]",
        state === "ON_BREAK" && "bg-warning/5",
        !attendanceAvailable && "bg-muted/40 shadow-none",
      )}
      title={!attendanceAvailable ? resource.data.unavailableReason : undefined}
    >
      <div
        className="flex min-w-24 items-center gap-2 px-2"
        role="timer"
        aria-label={
          attendanceAvailable
            ? `${statusLabel}, worked time ${elapsed}`
            : resource.data.unavailableReason
        }
        title={
          attendanceAvailable
            ? `${statusLabel}, ${elapsed}`
            : resource.data.unavailableReason
        }
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground",
            state === "CLOCKED_IN" && "bg-success/10 text-success-foreground",
            state === "ON_BREAK" && "bg-warning/15 text-warning-foreground",
          )}
          aria-hidden="true"
        >
          {state === "ON_BREAK" ? (
            <CoffeeIcon className="size-3.5" />
          ) : state === "CLOCKED_OUT" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <Clock3Icon className="size-3.5" />
          )}
        </span>
        <span
          className={cn(
            "text-xs font-semibold tracking-tight",
            attendanceAvailable && "font-mono tabular",
            state === "ON_BREAK" && "text-warning-foreground",
          )}
        >
          {attendanceAvailable ? elapsed : availabilityLabel}
        </span>
      </div>

      <Separator orientation="vertical" className="my-1" />

      {state === "NOT_CLOCKED_IN" ? (
        <Button
          variant="default"
          size="sm"
          disabled={pending || !attendanceAvailable}
          onClick={() => void transition("CLOCK_IN")}
        >
          {pendingAction === "CLOCK_IN" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <LogInIcon data-icon="inline-start" />
          )}
          {pendingAction === "CLOCK_IN" ? "Starting…" : "Check in"}
        </Button>
      ) : state === "CLOCKED_IN" ? (
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => void transition("BREAK_START")}
            aria-label="Take break"
          >
            {pendingAction === "BREAK_START" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CoffeeIcon data-icon="inline-start" />
            )}
            <span className="hidden xl:inline">Take break</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => void transition("CLOCK_OUT")}
            aria-label="Check out"
          >
            {pendingAction === "CLOCK_OUT" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <LogOutIcon data-icon="inline-start" />
            )}
            <span className="hidden lg:inline">Check out</span>
          </Button>
        </div>
      ) : state === "ON_BREAK" ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => void transition("BREAK_END")}
        >
          {pendingAction === "BREAK_END" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          {pendingAction === "BREAK_END" ? "Resuming…" : "Resume work"}
        </Button>
      ) : (
        <span className="px-2 text-xs font-medium text-muted-foreground">
          Done today
        </span>
      )}
    </div>
  );
}
