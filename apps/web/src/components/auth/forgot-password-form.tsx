"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const email = new FormData(event.currentTarget).get("email");
    try { await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setAccepted(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit request."); }
    finally { setPending(false); }
  }
  if (accepted) return <Alert className="border-success/30 bg-success/5"><CheckCircle2Icon className="text-success-foreground" /><AlertTitle>Request received</AlertTitle><AlertDescription>If that address belongs to an active account, a recovery link has been queued. <Link href="/sign-in" className="mt-3 block font-medium">Return to sign in</Link></AlertDescription></Alert>;
  return <form onSubmit={submit}><FieldGroup><Field data-invalid={Boolean(error)}><FieldLabel htmlFor="email">Work email</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" required /><FieldDescription>The response does not reveal whether an account exists.</FieldDescription><FieldError>{error}</FieldError></Field><Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : "Send recovery link"}</Button></FieldGroup><Link href="/sign-in" className="mt-7 inline-block text-sm font-medium text-primary hover:underline">Back to sign in</Link></form>;
}
