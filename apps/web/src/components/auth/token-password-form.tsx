"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function TokenPasswordForm({ token, mode }: { token?: string; mode: "activate" | "reset" }) {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(token ? "" : "This link is missing its security token.");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return;
    setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    const password = data.get("password");
    const confirmPassword = data.get("confirmPassword");
    try { await apiFetch(`/auth/${mode === "activate" ? "activate" : "reset-password"}`, { method: "POST", body: JSON.stringify({ token, password, confirmPassword }) }); setComplete(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The link could not be completed."); }
    finally { setPending(false); }
  }
  if (complete) return <Alert className="border-success/30 bg-success/5"><CheckCircle2Icon className="text-success-foreground" /><AlertTitle>{mode === "activate" ? "Account activated" : "Password updated"}</AlertTitle><AlertDescription>You can now sign in securely. <Link href="/sign-in" className="mt-3 block font-medium">Continue to sign in</Link></AlertDescription></Alert>;
  return <form onSubmit={submit}><FieldGroup><Field><FieldLabel htmlFor="new-password">New password</FieldLabel><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required disabled={!token} /><FieldDescription>Use 12+ characters with uppercase, lowercase, a number, and a symbol.</FieldDescription></Field><Field data-invalid={Boolean(error)}><FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required disabled={!token} /><FieldError>{error}</FieldError></Field><Button type="submit" size="lg" disabled={pending || !token}>{pending ? "Saving…" : mode === "activate" ? "Activate account" : "Set new password"}</Button></FieldGroup></form>;
}
