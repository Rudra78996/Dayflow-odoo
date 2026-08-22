"use client";

import { useState, type FormEvent } from "react";
import { UserPlusIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { InvitationDetails, type EmployeeInvitation } from "@/components/employees/employee-invitation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const roleItems = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "HR_OFFICER", label: "HR officer" },
];

export function CreateEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<EmployeeInvitation | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setError("");
      setInvitation(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await apiFetch<EmployeeInvitation>("/employees", { method: "POST", body: JSON.stringify(data) });
      setInvitation(result);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create employee.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon data-icon="inline-start" />
        Add employee
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{invitation ? "Employee created" : "Add an employee"}</DialogTitle>
          <DialogDescription>
            {invitation ? "The employee account is ready and the invitation delivery status is shown below." : "Create the employee record and issue a secure account-activation invitation."}
          </DialogDescription>
        </DialogHeader>
        {invitation ? (
          <>
            <InvitationDetails invitation={invitation} idPrefix="new-employee-invitation" />
            <DialogFooter><Button onClick={() => changeOpen(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="firstName">First name</FieldLabel><Input id="firstName" name="firstName" required /></Field>
                <Field><FieldLabel htmlFor="lastName">Last name</FieldLabel><Input id="lastName" name="lastName" required /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="workEmail">Work email</FieldLabel><Input id="workEmail" name="workEmail" type="email" required /></Field>
                <Field><FieldLabel htmlFor="workPhone">Work phone</FieldLabel><Input id="workPhone" name="workPhone" type="tel" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="jobTitle">Job title</FieldLabel><Input id="jobTitle" name="jobTitle" /></Field>
                <Field><FieldLabel htmlFor="dateOfJoining">Joining date</FieldLabel><Input id="dateOfJoining" name="dateOfJoining" type="date" required /></Field>
              </div>
              <Field>
                <FieldLabel>Access role</FieldLabel>
                <Select items={roleItems} name="role" defaultValue="EMPLOYEE">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{roleItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field data-invalid={Boolean(error)}><FieldError>{error}</FieldError></Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <UserPlusIcon data-icon="inline-start" />}
                {pending ? "Creating…" : "Create and invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
