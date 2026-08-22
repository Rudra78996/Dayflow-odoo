"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  SearchIcon,
  TimerResetIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  collectionItems,
  formatDate,
  formatMinutes,
  formatTime,
  getCollection,
  postJson,
  type AttendanceCorrection,
  type AttendanceRecord,
} from "@/lib/hr-api";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  DataEmpty,
  DataError,
  DataLoading,
  Metric,
  PageHeading,
  StatusBadge,
} from "@/components/hr/hr-primitives";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Mode = "self" | "team" | "corrections";

function shiftDate(value: string, amount: number, unit: "day" | "month") {
  const date = new Date(`${value}T12:00:00`);
  if (unit === "month") date.setMonth(date.getMonth() + amount, 1);
  else date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function periodLabel(value: string, mode: "self" | "team") {
  return new Intl.DateTimeFormat(
    "en-IN",
    mode === "self"
      ? { month: "long", year: "numeric" }
      : { weekday: "short", day: "2-digit", month: "short", year: "numeric" },
  ).format(new Date(`${value}T12:00:00`));
}

function AttendanceTable({
  rows,
  team,
  onChanged,
}: {
  rows: AttendanceRecord[];
  team: boolean;
  onChanged: () => void;
}) {
  if (!rows.length)
    return (
      <DataEmpty
        icon={CalendarClockIcon}
        title="No attendance records"
        description="Records will appear here after a clock event or approved adjustment."
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {team ? <TableHead>Employee</TableHead> : null}
          <TableHead>Date</TableHead>
          <TableHead>Check in</TableHead>
          <TableHead>Check out</TableHead>
          <TableHead>Work</TableHead>
          <TableHead>Extra</TableHead>
          <TableHead>Status</TableHead>
          {!team ? (
            <TableHead className="text-right">Correction</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {team ? (
              <TableCell className="font-medium">
                {row.employee
                  ? row.employee.preferredName ||
                    `${row.employee.firstName} ${row.employee.lastName}`
                  : "—"}
              </TableCell>
            ) : null}
            <TableCell>{formatDate(row.workDate)}</TableCell>
            <TableCell className="tabular">
              {formatTime(row.firstCheckIn)}
            </TableCell>
            <TableCell className="tabular">
              {formatTime(row.lastCheckOut)}
            </TableCell>
            <TableCell className="tabular">
              {formatMinutes(row.netMinutes)}
            </TableCell>
            <TableCell className="tabular">
              {formatMinutes(row.overtimeMinutes)}
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            {!team ? (
              <TableCell className="text-right">
                <CorrectionDialog recordId={row.id} onCreated={onChanged} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CorrectionDialog({
  recordId,
  onCreated,
}: {
  recordId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await postJson("/attendance/corrections", body);
      toast.success("Correction submitted");
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not submit correction.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <TimerResetIcon />
        Request
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request attendance correction</DialogTitle>
          <DialogDescription>
            Approval creates an auditable adjustment for the selected day; it
            never rewrites clock history.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <input type="hidden" name="attendanceRecordId" value={recordId} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`requestedCheckIn-${recordId}`}>
                  Correct check-in
                </FieldLabel>
                <Input
                  id={`requestedCheckIn-${recordId}`}
                  name="requestedCheckIn"
                  type="datetime-local"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`requestedCheckOut-${recordId}`}>
                  Correct check-out
                </FieldLabel>
                <Input
                  id={`requestedCheckOut-${recordId}`}
                  name="requestedCheckOut"
                  type="datetime-local"
                />
              </Field>
            </div>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={`reason-${recordId}`}>Reason</FieldLabel>
              <Textarea
                id={`reason-${recordId}`}
                name="reason"
                required
                rows={4}
                aria-invalid={Boolean(error)}
              />
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Submitting
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CorrectionsScreen() {
  const resource = useApiResource(
    () => getCollection<AttendanceCorrection>("/attendance/corrections"),
    [],
  );
  const rows = useMemo(() => collectionItems(resource.data), [resource.data]);
  async function decide(
    id: string,
    version: number,
    decision: "approve" | "reject",
  ) {
    try {
      await postJson(`/attendance/corrections/${id}/${decision}`, {
        version,
        comment:
          decision === "approve"
            ? "Approved from attendance review"
            : "Rejected from attendance review",
      });
      toast.success(`Correction ${decision}d`);
      await resource.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Decision failed.");
    }
  }
  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <PageHeading
        eyebrow="Attendance operations"
        title="Correction queue"
        description="Review requested adjustments without losing the original event history."
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Pending review</CardTitle>
          <CardDescription>
            Only one decision can succeed if multiple reviewers act at the same
            time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resource.loading ? (
            <DataLoading />
          ) : resource.error ? (
            <DataError error={resource.error} retry={resource.refresh} />
          ) : !rows.length ? (
            <DataEmpty
              icon={TimerResetIcon}
              title="Correction queue is clear"
              description="New employee requests will appear here for HR or Admin review."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested time</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.employee
                        ? `${row.employee.firstName} ${row.employee.lastName}`
                        : "—"}
                    </TableCell>
                    <TableCell>{formatDate(row.workDate)}</TableCell>
                    <TableCell>
                      {row.requestedCheckIn || "—"}–
                      {row.requestedCheckOut || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {row.reason}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(row.id, row.version, "reject")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => decide(row.id, row.version, "approve")}
                        >
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export function AttendanceScreen({ mode }: { mode: Mode }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const endpoint =
    mode === "team"
      ? `/attendance/team?date=${date}&search=${encodeURIComponent(search)}`
      : `/attendance/me?view=month&date=${date}`;
  const resource = useApiResource(
    () => getCollection<AttendanceRecord>(endpoint),
    [endpoint],
  );
  const rows = useMemo(() => collectionItems(resource.data), [resource.data]);
  if (mode === "corrections") return <CorrectionsScreen />;
  const present = rows.filter((row) => row.status === "PRESENT").length;
  const leave = rows.filter((row) => row.status === "LEAVE").length;
  const minutes = rows.reduce((total, row) => total + (row.netMinutes || 0), 0);
  const workingDays = rows.filter(
    (row) => !["HOLIDAY", "WEEK_OFF"].includes(row.status),
  ).length;
  const stepUnit = mode === "team" ? "day" : "month";
  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <PageHeading
        eyebrow="Attendance"
        title={mode === "team" ? "Team attendance" : "My attendance"}
        description={
          mode === "team"
            ? "Review the organization’s daily attendance, live states, work time, and exceptions."
            : "Clock your workday and review the schedule-aware record used by leave and payroll."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={mode === "team" ? "Present today" : "Present days"}
          value={present}
          detail="Validated attendance"
          icon={CheckCircle2Icon}
        />
        <Metric
          label="Leave days"
          value={leave}
          detail="Approved leave"
          icon={CalendarClockIcon}
        />
        <Metric
          label={mode === "team" ? "Loaded records" : "Working days"}
          value={mode === "team" ? rows.length : workingDays}
          detail={
            mode === "team"
              ? "For this local date"
              : "Excludes holidays and week-offs"
          }
          icon={CalendarClockIcon}
        />
        <Metric
          label="Net work time"
          value={formatMinutes(minutes)}
          detail={mode === "team" ? "Across loaded records" : "Current month"}
          icon={Clock3Icon}
        />
      </div>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>
                {mode === "team" ? "Daily register" : "Attendance history"}
              </CardTitle>
              <CardDescription>
                {mode === "team"
                  ? "Search and move across local work dates."
                  : "Move month by month through your own attendance records."}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {mode === "team" ? (
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    aria-label="Search employees"
                    placeholder="Search employee"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="flex items-center rounded-md border bg-background">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Previous ${stepUnit}`}
                  onClick={() =>
                    setDate((value) => shiftDate(value, -1, stepUnit))
                  }
                >
                  <ChevronLeftIcon />
                </Button>
                <label className="relative min-w-44 cursor-pointer px-2 text-center text-sm font-medium tabular">
                  <span>{periodLabel(date, mode)}</span>
                  <Input
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label={
                      mode === "team" ? "Attendance date" : "Attendance month"
                    }
                    type={mode === "team" ? "date" : "month"}
                    value={mode === "team" ? date : date.slice(0, 7)}
                    onChange={(event) =>
                      setDate(
                        `${event.target.value}${mode === "team" ? "" : "-01"}`,
                      )
                    }
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Next ${stepUnit}`}
                  onClick={() =>
                    setDate((value) => shiftDate(value, 1, stepUnit))
                  }
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {resource.loading ? (
            <DataLoading />
          ) : resource.error ? (
            <DataError error={resource.error} retry={resource.refresh} />
          ) : (
            <AttendanceTable
              rows={rows}
              team={mode === "team"}
              onChanged={resource.refresh}
            />
          )}
        </CardContent>
      </Card>
      {mode === "team" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <UsersRoundIcon className="size-3.5" />
          Live and historical rows are organization-scoped by the API.
        </p>
      ) : null}
    </main>
  );
}
