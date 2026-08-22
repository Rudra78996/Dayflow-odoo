"use client";

import { useState } from "react";
import { CheckCircle2Icon, CopyIcon, MailPlusIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

export type EmployeeInvitation = {
  id?: string;
  loginId: string;
  email?: string;
  status?: string;
  activationExpiresAt?: string;
  emailDelivery?: "sent" | "console" | "failed";
  emailError?: string;
  developmentToken?: string;
};

function activationLink(token: string) {
  return `${window.location.origin}/activate?token=${encodeURIComponent(token)}`;
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
}

export function InvitationDetails({ invitation, idPrefix }: { invitation: EmployeeInvitation; idPrefix: string }) {
  const link = invitation.developmentToken ? activationLink(invitation.developmentToken) : "";
  return (
    <div className="flex flex-col gap-5">
      <Alert variant={invitation.emailDelivery === "failed" ? "destructive" : "default"}>
        {invitation.emailDelivery === "failed" ? <ShieldAlertIcon /> : <CheckCircle2Icon />}
        <AlertTitle>{invitation.emailDelivery === "sent" ? "Invitation email sent" : invitation.emailDelivery === "failed" ? "Invitation email was not sent" : link ? "Local activation link ready" : "Email delivery needs attention"}</AlertTitle>
        <AlertDescription>
          {invitation.emailDelivery === "sent"
            ? `The activation email was sent to ${invitation.email ?? "the employee"}. It can be used once and expires after 72 hours.`
            : invitation.emailDelivery === "failed"
              ? `${invitation.emailError ?? "The email provider rejected the invitation."} You can use the local activation link below, then resend after fixing the sender configuration.`
            : link
              ? "Email is using the local fallback. Open this link on the employee's device to finish activation."
              : "The account was created, but the email provider did not accept the invitation. Check the email configuration, then resend it."}
        </AlertDescription>
      </Alert>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-login-id`}>Employee Login ID</FieldLabel>
          <InputGroup>
            <InputGroupInput id={`${idPrefix}-login-id`} value={invitation.loginId} readOnly />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Copy employee Login ID" onClick={() => void copy(invitation.loginId, "Login ID")}>
                <CopyIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        {link ? (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-activation-link`}>Local activation link</FieldLabel>
            <InputGroup>
              <InputGroupInput id={`${idPrefix}-activation-link`} value={link} readOnly />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Copy activation link" onClick={() => void copy(link, "Activation link")}>
                  <CopyIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>The employee sets their own password before signing in with their email or Login ID.</FieldDescription>
            <Button className="mt-2" nativeButton={false} render={<a href={link} />}>Open activation page</Button>
          </Field>
        ) : null}
      </FieldGroup>
    </div>
  );
}

export function EmployeeInvitationDialog({ employeeId, loginId }: { employeeId: string; loginId: string }) {
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

  async function generate() {
    setPending(true);
    setError("");
    try {
      const result = await apiFetch<EmployeeInvitation>(`/employees/${employeeId}/resend-activation`, { method: "POST" });
      setInvitation(result);
      toast.success(result.emailDelivery === "sent" ? "Activation email sent." : "A new activation link was generated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate an activation link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <MailPlusIcon data-icon="inline-start" />
        Resend invitation
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite {loginId}</DialogTitle>
          <DialogDescription>Send a fresh account-activation email to this invited employee.</DialogDescription>
        </DialogHeader>
        {invitation ? (
          <InvitationDetails invitation={invitation} idPrefix="profile-invitation" />
        ) : (
          <Alert variant={error ? "destructive" : "default"}>
            <ShieldAlertIcon />
            <AlertTitle>{error ? "Activation link unavailable" : "Previous links will stop working"}</AlertTitle>
            <AlertDescription>{error || "Generating a new link invalidates every unused activation link previously issued to this employee."}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          {invitation ? (
            <Button onClick={() => changeOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => changeOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={() => void generate()} disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <MailPlusIcon data-icon="inline-start" />}
                {pending ? "Sending…" : "Resend invitation"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
