"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  UsersRoundIcon,
} from "lucide-react";
import {
  apiFetch,
  type CurrentAccount,
  type EmployeeListItem,
} from "@/lib/api";
import { CreateEmployeeDialog } from "@/components/employees/create-employee-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DirectoryResult = {
  items: EmployeeListItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

function initials(item: EmployeeListItem) {
  return `${item.firstName[0] ?? ""}${item.lastName[0] ?? ""}`.toUpperCase();
}

function attendanceStatus(item: EmployeeListItem) {
  const status = item.attendanceRecords?.[0]?.status;
  if (status === "PRESENT")
    return { label: "Present", className: "bg-success" };
  if (status === "LEAVE") return { label: "On leave", className: "bg-leave" };
  if (status === "HOLIDAY" || status === "WEEK_OFF")
    return {
      label: status === "HOLIDAY" ? "Holiday" : "Week off",
      className: "bg-muted-foreground",
    };
  return {
    label: status
      ? status.toLowerCase().replaceAll("_", " ")
      : "Not checked in",
    className: "bg-warning",
  };
}

export function EmployeeDirectory() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [canCreate, setCanCreate] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setResult(
        await apiFetch<DirectoryResult>(
          `/employees?limit=12&page=${page}&search=${encodeURIComponent(search)}`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load employees.",
      );
    }
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);
  useEffect(() => {
    void apiFetch<CurrentAccount>("/auth/me").then((account) =>
      setCanCreate(account.roles.some(({ role }) => role.code === "ADMIN")),
    );
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            People
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Employee directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search public work profiles across your organization.
          </p>
        </div>
        {canCreate && (
          <CreateEmployeeDialog
            onCreated={() => setRefreshKey((value) => value + 1)}
          />
        )}
      </div>
      <div className="relative max-w-lg">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search name, Login ID, or role…"
          className="pl-9"
          aria-label="Search employees"
        />
      </div>
      <div
        className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"
        aria-label="Today’s attendance legend"
      >
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-leave" aria-hidden />
          On leave
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" aria-hidden />
          Not checked in or absent
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {!result && !error && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      {result?.items.length === 0 && (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No employees found</EmptyTitle>
            <EmptyDescription>
              {search
                ? "Try a broader name, Login ID, or role."
                : "Add the first employee to start your directory."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {result && result.items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((employee) => {
            const assignment = employee.assignments[0];
            const attendance = attendanceStatus(employee);
            return (
              <Link
                key={employee.id}
                href={`/employees/${employee.id}`}
                className="group relative flex min-w-0 items-start gap-3 rounded-xl bg-card p-4 pr-9 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:ring-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  title={attendance.label}
                  className={cn(
                    "absolute right-4 top-4 size-2.5 rounded-full ring-4 ring-card",
                    attendance.className,
                  )}
                  aria-label={`Today: ${attendance.label}`}
                />
                <Avatar size="lg">
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {initials(employee)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {employee.preferredName ||
                      `${employee.firstName} ${employee.lastName}`}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {employee.jobTitle || "Role not assigned"}
                  </p>
                  <p className="mt-3 truncate text-xs text-muted-foreground">
                    {assignment?.department?.name || "No department"} ·{" "}
                    <span className="tabular">{employee.loginId}</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {result && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground tabular">
            Page {result.pagination.page} of{" "}
            {Math.max(result.pagination.pages, 1)} · {result.pagination.total}{" "}
            employees
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              aria-label="Previous employee page"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= result.pagination.pages}
              onClick={() => setPage((value) => value + 1)}
              aria-label="Next employee page"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
