"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  PlusIcon,
  SearchIcon,
  UmbrellaIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, type EmployeeListItem } from "@/lib/api";
import {
  collectionItems,
  formatDate,
  getCollection,
  postJson,
  type Holiday,
  type LeaveAllocation,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
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
import { TimeOffYearCalendar } from "@/components/hr/time-off-year-calendar";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

type Mode = "self" | "requests" | "allocations";

const requestStatusItems = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All statuses", value: "ALL" },
];

function TimeOffOperationsNav({
  active,
}: {
  active: "requests" | "allocations";
}) {
  const items = [
    { href: "/time-off/requests", label: "Time Off", value: "requests" },
    {
      href: "/time-off/allocations",
      label: "Allocation",
      value: "allocations",
    },
  ] as const;
  return (
    <nav
      aria-label="Time Off administration"
      className="flex w-fit rounded-lg bg-muted p-1"
    >
      {items.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          aria-current={active === item.value ? "page" : undefined}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active === item.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function postCalendar(year: number) {
  return apiFetch<{
    year: number;
    requests: LeaveRequest[];
    holidays: Holiday[];
  }>(`/leave-calendar?year=${year}`);
}

function LeaveRequestDialog({
  leaveTypes,
  onCreated,
}: {
  leaveTypes: LeaveType[];
  onCreated: () => void;
}) {
  const leaveTypeItems = [
    { label: "Select leave type", value: null },
    ...leaveTypes.map((type) => ({ label: type.name, value: type.id })),
  ];
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await postJson("/leave-requests", values);
      toast.success("Leave request submitted", {
        description:
          "Your calendar will show the request as pending until a decision is made.",
      });
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not submit leave request.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Request time off
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>
            Weekends and holidays are excluded according to the effective
            policy. Your balance is rechecked when HR decides.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Leave type</FieldLabel>
              <Select items={leaveTypeItems} name="leaveTypeId" required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {leaveTypeItems.map((type) => (
                      <SelectItem
                        key={type.value ?? "placeholder"}
                        value={type.value}
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startDate">Starts</FieldLabel>
                <Input id="startDate" name="startDate" type="date" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">Ends</FieldLabel>
                <Input id="endDate" name="endDate" type="date" required />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" name="remarks" rows={3} />
              <FieldDescription>
                Requested units are calculated by the server from these dates,
                weekends, holidays, and the active policy.
              </FieldDescription>
            </Field>
            <Field data-invalid={Boolean(error)}>
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
            <Button type="submit" disabled={pending || leaveTypes.length === 0}>
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

function SelfTimeOff() {
  const [year, setYear] = useState(new Date().getFullYear());
  const balancesResource = useApiResource(
    () => getCollection<LeaveBalance>("/leave-balances"),
    [],
  );
  const calendarResource = useApiResource(() => postCalendar(year), [year]);
  const typesResource = useApiResource(
    () => getCollection<LeaveType>("/leave-types"),
    [],
  );
  const balances = useMemo(
    () => collectionItems(balancesResource.data),
    [balancesResource.data],
  );
  const requests = calendarResource.data?.requests || [];
  const types = useMemo(
    () => collectionItems(typesResource.data),
    [typesResource.data],
  );
  const holidays = calendarResource.data?.holidays || [];
  const loading =
    balancesResource.loading ||
    calendarResource.loading ||
    typesResource.loading;
  const error =
    balancesResource.error || calendarResource.error || typesResource.error;
  const pending = requests.filter(
    (request) => request.status === "PENDING",
  ).length;
  const approvedUnits = requests
    .filter((request) => request.status === "APPROVED")
    .reduce((total, request) => total + Number(request.requestedUnits), 0);
  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <PageHeading
        eyebrow="Time off"
        title="Your leave year at a glance"
        description="Plan time away against live balances, follow every request, and see the holidays that apply to your location."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous leave year"
                onClick={() => setYear((value) => value - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="min-w-16 text-center text-sm font-semibold tabular">
                {year}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next leave year"
                onClick={() => setYear((value) => value + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            <LeaveRequestDialog
              leaveTypes={types}
              onCreated={calendarResource.refresh}
            />
          </>
        }
      />
      {loading ? (
        <DataLoading rows={7} />
      ) : error ? (
        <DataError
          error={error}
          retry={() => {
            void balancesResource.refresh();
            void calendarResource.refresh();
            void typesResource.refresh();
          }}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {balances.map((balance) => (
              <Card key={balance.leaveType.id} size="sm">
                <CardHeader>
                  <CardTitle>{balance.leaveType.name}</CardTitle>
                  <CardDescription>
                    {balance.leaveType.code || "Available leave"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-[-0.04em] tabular">
                    {balance.balance ?? balance.available ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    days available
                  </p>
                </CardContent>
              </Card>
            ))}
            <Metric
              label="Pending requests"
              value={pending}
              detail="Awaiting a decision"
              icon={CalendarDaysIcon}
            />
            <Metric
              label={`Approved in ${year}`}
              value={approvedUnits}
              detail="Counted leave units"
              icon={CheckIcon}
            />
          </div>
          <TimeOffYearCalendar
            year={year}
            requests={requests}
            holidays={holidays}
          />
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Request history</CardTitle>
              <CardDescription>
                Your requests and the reviewer comments recorded against them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dates</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Reviewer comment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          {formatDate(request.startDate)}–
                          {formatDate(request.endDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.leaveType.name}
                        </TableCell>
                        <TableCell className="tabular">
                          {request.requestedUnits}
                        </TableCell>
                        <TableCell className="max-w-52 text-muted-foreground">
                          {request.remarks || "—"}
                        </TableCell>
                        <TableCell className="max-w-52 text-muted-foreground">
                          {request.decisionComment || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <DataEmpty
                  icon={UmbrellaIcon}
                  title="No requests in this year"
                  description="Use Request time off to create your first request."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function LeaveDecisionDialog({
  request,
  decision,
  onDecided,
}: {
  request: LeaveRequest;
  decision: "approve" | "reject";
  onDecided: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const approve = decision === "approve";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const comment = new FormData(event.currentTarget).get("comment");
    try {
      await postJson(`/leave-requests/${request.id}/${decision}`, {
        version: request.version,
        comment,
      });
      toast.success(`Request ${approve ? "approved" : "rejected"}`);
      setOpen(false);
      onDecided();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Decision failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={approve ? "default" : "outline"} size="sm" />}
      >
        {approve ? (
          <CheckIcon data-icon="inline-start" />
        ) : (
          <XIcon data-icon="inline-start" />
        )}
        {approve ? "Approve" : "Reject"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {approve ? "Approve" : "Reject"} leave request
          </DialogTitle>
          <DialogDescription>
            {request.employee
              ? request.employee.preferredName ||
                `${request.employee.firstName} ${request.employee.lastName}`
              : "This employee"}{" "}
            requested {request.requestedUnits} day
            {Number(request.requestedUnits) === 1 ? "" : "s"} of{" "}
            {request.leaveType.name}.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel
                htmlFor={`decision-comment-${request.id}-${decision}`}
              >
                Reviewer comment
              </FieldLabel>
              <Textarea
                id={`decision-comment-${request.id}-${decision}`}
                name="comment"
                rows={4}
                required
                aria-invalid={Boolean(error)}
                placeholder={
                  approve
                    ? "Confirm why this request is approved"
                    : "Explain why this request cannot be approved"
                }
              />
              <FieldDescription>
                The employee can see this comment with the recorded decision.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : approve ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <XIcon data-icon="inline-start" />
              )}
              {pending
                ? "Saving…"
                : approve
                  ? "Approve request"
                  : "Reject request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminRequests() {
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const resource = useApiResource(
    () =>
      getCollection<LeaveRequest>(
        `/leave-requests${status === "ALL" ? "" : `?status=${status}`}`,
      ),
    [status],
  );
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = collectionItems(resource.data);
    if (!query) return items;
    return items.filter((request) => {
      const employee = request.employee
        ? `${request.employee.firstName} ${request.employee.lastName} ${request.employee.preferredName || ""}`
        : "";
      return `${employee} ${request.leaveType.name} ${request.status} ${request.remarks || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [resource.data, search]);
  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <TimeOffOperationsNav active="requests" />
      <PageHeading
        eyebrow="Time-off operations"
        title="Leave requests"
        description="Search every request, record the reviewer’s decision, and immediately update leave and attendance ledgers."
        actions={
          <Select
            items={requestStatusItems}
            value={status}
            onValueChange={(value) => setStatus(value || "PENDING")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {requestStatusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Decision queue</CardTitle>
          <CardDescription>
            Approval rechecks the latest balance; stale or duplicate decisions
            are rejected.
          </CardDescription>
          <div className="mt-3 max-w-md">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee, leave type, status, or remarks"
                aria-label="Search leave requests"
              />
            </InputGroup>
          </div>
        </CardHeader>
        <CardContent>
          {resource.loading ? (
            <DataLoading />
          ) : resource.error ? (
            <DataError error={resource.error} retry={resource.refresh} />
          ) : !rows.length ? (
            <DataEmpty
              icon={UmbrellaIcon}
              title="No matching requests"
              description={
                search
                  ? "Try a broader employee name, type, or status."
                  : "Try another status or return when a new request is submitted."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.employee
                        ? request.employee.preferredName ||
                          `${request.employee.firstName} ${request.employee.lastName}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {formatDate(request.startDate)}–
                      {formatDate(request.endDate)}
                    </TableCell>
                    <TableCell>{request.leaveType.name}</TableCell>
                    <TableCell className="tabular">
                      {request.requestedUnits}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate text-sm text-muted-foreground">
                        {request.decisionComment || request.remarks || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {request.status === "PENDING" ? (
                          <>
                            <LeaveDecisionDialog
                              request={request}
                              decision="reject"
                              onDecided={resource.refresh}
                            />
                            <LeaveDecisionDialog
                              request={request}
                              decision="approve"
                              onDecided={resource.refresh}
                            />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Decision recorded
                          </span>
                        )}
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

function AllocationDialog({
  employees,
  leaveTypes,
  onCreated,
}: {
  employees: EmployeeListItem[];
  leaveTypes: LeaveType[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const employeeItems = [
    { label: "Select employee", value: null },
    ...employees.map((employee) => ({
      label: `${employee.preferredName || `${employee.firstName} ${employee.lastName}`} · ${employee.loginId}`,
      value: employee.id,
    })),
  ];
  const leaveTypeItems = [
    { label: "Select leave type", value: null },
    ...leaveTypes.map((type) => ({ label: type.name, value: type.id })),
  ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await postJson("/leave-allocations", {
        ...values,
        units: Number(values.units),
        expiresAt: values.expiresAt || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Leave balance allocated");
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create this allocation.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New allocation
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocate leave balance</DialogTitle>
          <DialogDescription>
            Add a traceable manual credit or debit to an employee’s leave
            ledger. This does not rewrite prior entries.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Employee</FieldLabel>
              <Select items={employeeItems} name="employeeId" required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {employeeItems.map((item) => (
                      <SelectItem
                        key={item.value ?? "employee-placeholder"}
                        value={item.value}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Leave type</FieldLabel>
              <Select items={leaveTypeItems} name="leaveTypeId" required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {leaveTypeItems.map((item) => (
                      <SelectItem
                        key={item.value ?? "type-placeholder"}
                        value={item.value}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="allocation-units">Units</FieldLabel>
                <Input
                  id="allocation-units"
                  name="units"
                  type="number"
                  step="0.5"
                  required
                />
                <FieldDescription>
                  Use a negative value for a manual debit.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="allocation-effective">
                  Effective date
                </FieldLabel>
                <Input
                  id="allocation-effective"
                  name="effectiveDate"
                  type="date"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="allocation-expires">Expires on</FieldLabel>
              <Input id="allocation-expires" name="expiresAt" type="date" />
            </Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="allocation-note">Reason</FieldLabel>
              <Textarea
                id="allocation-note"
                name="note"
                rows={3}
                required
                aria-invalid={Boolean(error)}
                placeholder="Explain why this manual adjustment is needed"
              />
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !employees.length || !leaveTypes.length}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {pending ? "Allocating…" : "Create allocation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Allocations() {
  const resource = useApiResource(
    () => getCollection<LeaveAllocation>("/leave-allocations"),
    [],
  );
  const employeesResource = useApiResource(
    () => getCollection<EmployeeListItem>("/employees?limit=100&page=1"),
    [],
  );
  const leaveTypesResource = useApiResource(
    () => getCollection<LeaveType>("/leave-types"),
    [],
  );
  const rows = useMemo(() => collectionItems(resource.data), [resource.data]);
  const employees = useMemo(
    () => collectionItems(employeesResource.data),
    [employeesResource.data],
  );
  const leaveTypes = useMemo(
    () => collectionItems(leaveTypesResource.data),
    [leaveTypesResource.data],
  );
  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <TimeOffOperationsNav active="allocations" />
      <PageHeading
        eyebrow="Time-off operations"
        title="Leave allocations"
        description="Trace every policy-generated or manual credit behind an employee’s current balance."
        actions={
          <AllocationDialog
            employees={employees}
            leaveTypes={leaveTypes}
            onCreated={resource.refresh}
          />
        }
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Allocation ledger</CardTitle>
          <CardDescription>
            Credits remain explainable after later policy changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resource.loading ? (
            <DataLoading />
          ) : resource.error ? (
            <DataError error={resource.error} retry={resource.refresh} />
          ) : !rows.length ? (
            <DataEmpty
              icon={CircleDollarSignIcon}
              title="No allocations yet"
              description="Policy-generated and manual balance credits will appear here."
              action={
                <AllocationDialog
                  employees={employees}
                  leaveTypes={leaveTypes}
                  onCreated={resource.refresh}
                />
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Effective date</TableHead>
                  <TableHead>Source</TableHead>
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
                    <TableCell>{row.leaveType.name}</TableCell>
                    <TableCell className="tabular">{row.units}</TableCell>
                    <TableCell>{formatDate(row.effectiveDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.source || "MANUAL"} />
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

export function TimeOffScreen({ mode }: { mode: Mode }) {
  return mode === "self" ? (
    <SelfTimeOff />
  ) : mode === "requests" ? (
    <AdminRequests />
  ) : (
    <Allocations />
  );
}
