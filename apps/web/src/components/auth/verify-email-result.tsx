"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function VerifyEmailResult({ token }: { token?: string }) {
  const [state, setState] = useState<"loading" | "complete" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is missing its token.");
  useEffect(() => { if (!token) return; apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }).then(() => setState("complete")).catch((cause) => { setMessage(cause instanceof Error ? cause.message : "Verification failed."); setState("error"); }); }, [token]);
  if (state === "loading") return <div className="flex flex-col gap-3"><Skeleton className="h-20 rounded-xl" /><p className="text-sm text-muted-foreground">Verifying your email…</p></div>;
  return <Alert variant={state === "error" ? "destructive" : "default"} className={state === "complete" ? "border-success/30 bg-success/5" : undefined}>{state === "complete" ? <CheckCircle2Icon className="text-success-foreground" /> : <CircleAlertIcon />}<AlertTitle>{state === "complete" ? "Email verified" : "Verification failed"}</AlertTitle><AlertDescription>{state === "complete" ? "Your administrator account is now active." : message}<Link href="/sign-in" className="mt-3 block font-medium">Continue to sign in</Link></AlertDescription></Alert>;
}
