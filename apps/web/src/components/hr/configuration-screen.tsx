"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { CalendarDaysIcon, CalendarPlusIcon, Clock3Icon, Layers3Icon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { useApiResource } from "@/hooks/use-api-resource";
import { collectionItems, formatClockMinutes, formatDate, getCollection, postJson, type Holiday, type LeavePolicy, type LeaveType, type SalaryStructure, type Schedule } from "@/lib/hr-api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataEmpty, DataError, DataLoading, PageHeading, StatusBadge } from "@/components/hr/hr-primitives";

type Kind = "schedules" | "holidays" | "leave-types" | "leave-policies" | "salary-structures";

const copy: Record<Kind, { eyebrow: string; title: string; description: string; endpoint: string; create: string; empty: string }> = {
  schedules: { eyebrow: "Calendar settings", title: "Work schedules", description: "Define effective shifts, breaks, working days, and timezone rules that attendance can trust.", endpoint: "/schedules", create: "New schedule", empty: "No schedules configured" },
  holidays: { eyebrow: "Calendar settings", title: "Holiday calendar", description: "Maintain organization and location holidays without changing historical attendance periods.", endpoint: "/holidays", create: "Add holiday", empty: "No holidays in this calendar" },
  "leave-types": { eyebrow: "Time-off settings", title: "Leave types & policies", description: "Control paid status, evidence rules, and effective policy versions for each leave category.", endpoint: "/leave-types", create: "Add leave type", empty: "No leave types configured" },
  "leave-policies": { eyebrow: "Time-off settings", title: "Leave policies", description: "Version annual entitlement, accrual, carry-forward, and negative-balance rules independently from leave types.", endpoint: "/leave-policies", create: "Add leave policy", empty: "No leave policies configured" },
  "salary-structures": { eyebrow: "Payroll settings", title: "Salary structures", description: "Version earnings, deductions, and employer contributions with explicit effective dates.", endpoint: "/salary-structures", create: "New structure", empty: "No salary structures configured" },
};

function AssignScheduleDialog({ scheduleId }: { scheduleId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try { await postJson(`/schedules/${scheduleId}/assignments`, Object.fromEntries(new FormData(event.currentTarget))); toast.success("Schedule assignment created"); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not assign schedule."); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="ghost" size="sm" />}>Assign</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Assign work schedule</DialogTitle><DialogDescription>Create an effective employee assignment. Overlapping primary assignments are rejected.</DialogDescription></DialogHeader><form onSubmit={submit} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor={`employee-${scheduleId}`}>Employee ID</FieldLabel><Input id={`employee-${scheduleId}`} name="employeeId" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor={`from-${scheduleId}`}>Effective from</FieldLabel><Input id={`from-${scheduleId}`} name="effectiveFrom" type="date" required /></Field><Field><FieldLabel htmlFor={`to-${scheduleId}`}>Effective to</FieldLabel><Input id={`to-${scheduleId}`} name="effectiveTo" type="date" /></Field></div><Field data-invalid={Boolean(error)}><FieldError>{error}</FieldError></Field></FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <><Spinner />Assigning</> : "Create assignment"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function CreateConfigurationDialog({ kind, onCreated }: { kind: Kind; onCreated: () => void }) {
  const config = copy[kind];
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body: Record<string, unknown> = { ...values };
    if (kind === "schedules") {
      const minutes = (value: FormDataEntryValue | undefined) => { const [hours, mins] = String(value || "00:00").split(":").map(Number); return hours * 60 + mins; };
      body.workingWeekdays = String(values.workingDays || "1,2,3,4,5").split(",").map((value) => Number(value.trim()));
      body.shiftStartMinutes = minutes(values.startTime);
      body.shiftEndMinutes = minutes(values.endTime);
      body.overnight = Number(body.shiftEndMinutes) <= Number(body.shiftStartMinutes);
      body.paidBreakMinutes = Number(values.paidBreakMinutes || 0);
      body.unpaidBreakMinutes = Number(values.unpaidBreakMinutes || 0);
      body.graceMinutes = Number(values.graceMinutes || 0);
      body.halfDayMinutes = Number(values.halfDayMinutes || 240);
      body.fullDayMinutes = Number(values.fullDayMinutes || 480);
      body.overtimeAfterMinutes = Number(values.overtimeAfterMinutes || 480);
      delete body.startTime; delete body.endTime; delete body.workingDays;
    }
    if (kind === "holidays") body.optional = values.optional === "on";
    if (kind === "leave-types") {
      body.paid = values.paid === "on";
      body.halfDaySupported = values.halfDaySupported === "on";
      body.approvalRequired = true;
      body.allowNegative = values.allowNegative === "on";
      body.attachmentAfterUnits = values.attachmentAfterUnits ? Number(values.attachmentAfterUnits) : undefined;
    }
    if (kind === "leave-policies") {
      body.annualEntitlement = Number(values.annualEntitlement || 0);
      body.carryForwardCap = values.carryForwardCap ? Number(values.carryForwardCap) : undefined;
      body.carryForward = values.carryForward === "on";
      body.prorateJoining = true;
      body.excludeWeekends = true;
      body.excludeHolidays = true;
      body.cancellationAllowed = true;
    }
    if (kind === "salary-structures") {
      body.components = [
        { code: "BASIC", name: "Basic Salary", componentType: "EARNING", calculationMode: "PERCENTAGE", basis: "WAGE", value: Number(values.basicRate || 50), displayOrder: 10, taxable: true },
        { code: "FIXED_ALLOWANCE", name: "Fixed Allowance", componentType: "BALANCING", calculationMode: "FIXED", value: 0, displayOrder: 20, taxable: true },
      ];
      delete body.basicRate;
    }
    try {
      await postJson(config.endpoint, body);
      toast.success(`${kind === "holidays" ? "Holiday" : kind === "leave-types" ? "Leave type" : kind === "salary-structures" ? "Salary structure" : "Schedule"} created`);
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The configuration could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}><PlusIcon />{config.create}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{config.create}</DialogTitle><DialogDescription>Changes become effective on the selected date and remain available in the audit history.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field><FieldLabel htmlFor={`${kind}-name`}>Name</FieldLabel><Input id={`${kind}-name`} name="name" required /></Field>
            {kind === "schedules" ? <>
              <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="startTime">Shift starts</FieldLabel><Input id="startTime" name="startTime" type="time" required /></Field><Field><FieldLabel htmlFor="endTime">Shift ends</FieldLabel><Input id="endTime" name="endTime" type="time" required /></Field></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="unpaidBreakMinutes">Unpaid break</FieldLabel><Input id="unpaidBreakMinutes" name="unpaidBreakMinutes" type="number" min="0" defaultValue="60" required /></Field><Field><FieldLabel htmlFor="paidBreakMinutes">Paid break</FieldLabel><Input id="paidBreakMinutes" name="paidBreakMinutes" type="number" min="0" defaultValue="0" required /></Field></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="graceMinutes">Grace period</FieldLabel><Input id="graceMinutes" name="graceMinutes" type="number" min="0" defaultValue="15" required /></Field><Field><FieldLabel htmlFor="timezone">Timezone</FieldLabel><Input id="timezone" name="timezone" defaultValue="Asia/Kolkata" required /></Field></div>
              <div className="grid gap-4 sm:grid-cols-3"><Field><FieldLabel htmlFor="halfDayMinutes">Half day</FieldLabel><Input id="halfDayMinutes" name="halfDayMinutes" type="number" min="1" defaultValue="240" required /></Field><Field><FieldLabel htmlFor="fullDayMinutes">Full day</FieldLabel><Input id="fullDayMinutes" name="fullDayMinutes" type="number" min="1" defaultValue="480" required /></Field><Field><FieldLabel htmlFor="overtimeAfterMinutes">Overtime after</FieldLabel><Input id="overtimeAfterMinutes" name="overtimeAfterMinutes" type="number" min="1" defaultValue="480" required /></Field></div>
              <Field><FieldLabel htmlFor="workingDays">Working weekdays</FieldLabel><Input id="workingDays" name="workingDays" defaultValue="1,2,3,4,5" required /><FieldDescription>ISO weekdays: Monday is 1 and Sunday is 7.</FieldDescription></Field>
            </> : null}
            {kind === "holidays" ? <><Field><FieldLabel htmlFor="date">Holiday date</FieldLabel><Input id="date" name="date" type="date" required /></Field><Field orientation="horizontal"><Checkbox id="optional" name="optional" /><FieldLabel htmlFor="optional">Optional holiday</FieldLabel></Field></> : null}
            {kind === "leave-types" ? <><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="code">Stable code</FieldLabel><Input id="code" name="code" placeholder="PAID_TIME_OFF" required /></Field><Field><FieldLabel htmlFor="color">Calendar color</FieldLabel><Input id="color" name="color" type="color" defaultValue="#65558f" required /></Field></div><Field><FieldLabel htmlFor="attachmentAfterUnits">Evidence after units</FieldLabel><Input id="attachmentAfterUnits" name="attachmentAfterUnits" type="number" min="0.5" step="0.5" /><FieldDescription>Leave blank when evidence is not required.</FieldDescription></Field><div className="grid gap-3 sm:grid-cols-3"><Field orientation="horizontal"><Checkbox id="paid" name="paid" /><FieldLabel htmlFor="paid">Paid leave</FieldLabel></Field><Field orientation="horizontal"><Checkbox id="halfDaySupported" name="halfDaySupported" defaultChecked /><FieldLabel htmlFor="halfDaySupported">Half-days</FieldLabel></Field><Field orientation="horizontal"><Checkbox id="allowNegative" name="allowNegative" /><FieldLabel htmlFor="allowNegative">Negative balance</FieldLabel></Field></div></> : null}
            {kind === "leave-policies" ? <><Field><FieldLabel htmlFor="leaveTypeId">Leave type ID</FieldLabel><Input id="leaveTypeId" name="leaveTypeId" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="annualEntitlement">Annual entitlement</FieldLabel><Input id="annualEntitlement" name="annualEntitlement" type="number" min="0" step="0.5" required /></Field><Field><FieldLabel htmlFor="carryForwardCap">Carry-forward cap</FieldLabel><Input id="carryForwardCap" name="carryForwardCap" type="number" min="0" step="0.5" /></Field></div><Field><FieldLabel htmlFor="accrualFrequency">Accrual frequency</FieldLabel><Input id="accrualFrequency" name="accrualFrequency" defaultValue="ANNUAL" required /></Field><Field orientation="horizontal"><Checkbox id="carryForward" name="carryForward" /><FieldLabel htmlFor="carryForward">Carry unused balance forward</FieldLabel></Field></> : null}
            {kind === "salary-structures" ? <><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="code">Stable code</FieldLabel><Input id="code" name="code" placeholder="INDIA_STANDARD" required /></Field><Field><FieldLabel htmlFor="currency">Currency</FieldLabel><Input id="currency" name="currency" defaultValue="INR" required /></Field></div><Field><FieldLabel htmlFor="basicRate">Initial Basic rate (% of wage)</FieldLabel><Input id="basicRate" name="basicRate" type="number" min="0" max="100" step="0.01" defaultValue="50" required /><FieldDescription>The first version adds a balancing allowance so total earnings always reconcile to the monthly wage. Add approved components through the next effective version.</FieldDescription></Field></> : null}
            <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="effectiveFrom">Effective from</FieldLabel><Input id="effectiveFrom" name="effectiveFrom" type="date" required aria-invalid={Boolean(error)} /><FieldError>{error}</FieldError></Field>
          </FieldGroup>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <><Spinner />Saving</> : "Save configuration"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfigurationScreen({ kind }: { kind: Kind }) {
  const config = copy[kind];
  const resource = useApiResource(() => getCollection<Schedule | Holiday | LeaveType | LeavePolicy | SalaryStructure>(config.endpoint), [config.endpoint]);
  const items = useMemo(() => collectionItems(resource.data), [resource.data]);

  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <PageHeading eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<CreateConfigurationDialog kind={kind} onCreated={resource.refresh} />} />
      <Card>
        <CardHeader className="border-b"><CardTitle>Effective configurations</CardTitle><CardDescription>Current and historical versions returned for your organization.</CardDescription></CardHeader>
        <CardContent>
          {resource.loading ? <DataLoading /> : resource.error ? <DataError error={resource.error} retry={resource.refresh} /> : items.length === 0 ? <DataEmpty icon={kind === "schedules" ? Clock3Icon : kind === "holidays" ? CalendarDaysIcon : kind === "leave-types" || kind === "leave-policies" ? ShieldCheckIcon : Layers3Icon} title={config.empty} description="Create the first effective configuration to unlock downstream workflows." action={<CreateConfigurationDialog kind={kind} onCreated={resource.refresh} />} /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>{kind === "holidays" ? "Date" : "Effective from"}</TableHead><TableHead>Details</TableHead><TableHead>Status</TableHead>{kind === "schedules" ? <TableHead className="text-right">Assignment</TableHead> : null}</TableRow></TableHeader>
              <TableBody>{items.map((item) => {
                const schedule = item as Schedule;
                const holiday = item as Holiday;
                const leaveType = item as LeaveType;
                const policy = item as LeavePolicy;
                const salary = item as SalaryStructure;
                const detail = kind === "schedules" ? `${formatClockMinutes(schedule.shiftStartMinutes)}–${formatClockMinutes(schedule.shiftEndMinutes)} · ${schedule.timezone || "Organization timezone"}` : kind === "holidays" ? holiday.location?.name || (holiday.optional ? "Optional" : "Organization-wide") : kind === "leave-types" ? `${leaveType.paid ? "Paid" : "Unpaid"}${leaveType.attachmentAfterUnits ? " · Evidence required" : ""}` : kind === "leave-policies" ? `${policy.annualEntitlement ?? 0} units · ${policy.accrualFrequency || "Annual"} accrual` : `${salary.components?.length ?? 0} components · v${salary.version ?? 1}`;
                const date = kind === "holidays" ? holiday.date : kind === "leave-policies" ? policy.effectiveFrom : schedule.effectiveFrom || salary.effectiveFrom;
                return <TableRow key={item.id}><TableCell className="font-medium">{kind === "salary-structures" ? <Link href={`/salary-structures/${item.id}`} className="underline-offset-4 hover:text-primary hover:underline">{item.name}</Link> : item.name}</TableCell><TableCell>{formatDate(date)}</TableCell><TableCell className="max-w-xs truncate text-muted-foreground">{detail}</TableCell><TableCell><StatusBadge status={(item as { status?: string; active?: boolean }).status || ((item as { active?: boolean }).active === false ? "INACTIVE" : "ACTIVE")} /></TableCell>{kind === "schedules" ? <TableCell className="text-right"><AssignScheduleDialog scheduleId={item.id} /></TableCell> : null}</TableRow>;
              })}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {kind === "holidays" ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarPlusIcon className="size-3.5" />Location-specific holidays appear only for employees assigned to that location.</p> : null}
    </main>
  );
}
