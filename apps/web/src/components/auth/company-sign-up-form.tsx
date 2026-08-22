"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

type SignUpResult = {
  email?: string;
  emailDelivery?: "sent" | "console" | "failed";
  developmentToken?: string;
};

export function CompanySignUpForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SignUpResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      setResult(await apiFetch<SignUpResult>("/auth/company-sign-up", { method: "POST", body: JSON.stringify(data) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account setup failed.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const verificationHref = result.developmentToken
      ? `/verify-email?token=${encodeURIComponent(result.developmentToken)}`
      : "";
    return (
      <Alert className="border-success/30 bg-success/5 text-success-foreground">
        <CheckCircle2Icon />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          {result.emailDelivery === "sent"
            ? `We sent a verification link to ${result.email ?? "your work email"}. Open it to activate the administrator account.`
            : "Your workspace is ready. Email delivery is using the local fallback, so you can open the verification link below."}
          <div className="mt-4 flex flex-wrap gap-3">
            {verificationHref ? <Link href={verificationHref} className="font-medium underline underline-offset-4">Verify this local account</Link> : null}
            <Link href="/sign-in" className="font-medium underline underline-offset-4">Return to sign in</Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field><FieldLabel htmlFor="companyName">Company name</FieldLabel><Input id="companyName" name="companyName" placeholder="Acme Labs" required minLength={2} /></Field>
          <Field><FieldLabel htmlFor="companyPrefix">Company prefix</FieldLabel><Input id="companyPrefix" name="companyPrefix" placeholder="AC" required minLength={2} maxLength={4} pattern="[A-Z0-9]{2,4}" className="uppercase" /><FieldDescription>2–4 uppercase letters or numbers.</FieldDescription></Field>
        </div>
        <Field><FieldLabel htmlFor="adminName">Administrator name</FieldLabel><Input id="adminName" name="adminName" autoComplete="name" required minLength={2} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field><FieldLabel htmlFor="email">Work email</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
          <Field><FieldLabel htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></FieldLabel><Input id="phone" name="phone" type="tel" autoComplete="tel" /></Field>
        </div>
        <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="new-password">Password</FieldLabel><Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} /><FieldDescription>At least 12 characters with uppercase, lowercase, a number, and a symbol.</FieldDescription></Field>
        <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} /><FieldError>{error}</FieldError></Field>
        <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Creating workspace…" : "Create company workspace"}</Button>
      </FieldGroup>
      <p className="mt-7 text-center text-sm text-muted-foreground">Already have an account?{" "}<Link href="/sign-in" className="font-medium text-foreground hover:underline">Sign in</Link></p>
    </form>
  );
}
