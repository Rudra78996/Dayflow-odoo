"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRightIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function SignInForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ identifier: data.get("identifier"), password: data.get("password") }),
      });
      toast.success("Welcome back");
      router.push("/employees");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="identifier">Work email or Login ID</FieldLabel>
          <Input id="identifier" name="identifier" autoComplete="username" placeholder="you@company.com" required autoFocus />
          <FieldDescription>Login IDs look like OIJODO20260001.</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(error)}>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link className="text-xs font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="pr-10" required />
            <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
          {!pending && <ArrowRightIcon data-icon="inline-end" />}
        </Button>
      </FieldGroup>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Setting up Dayflow?{" "}<Link href="/sign-up" className="font-medium text-foreground hover:underline">Create your company</Link>
      </p>
    </form>
  );
}
