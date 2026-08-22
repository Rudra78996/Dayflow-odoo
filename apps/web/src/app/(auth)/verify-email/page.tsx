import { AuthFrame } from "@/components/auth-frame";
import { VerifyEmailResult } from "@/components/auth/verify-email-result";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthFrame eyebrow="Email verification" title="Securing your workspace" description="We’re confirming the administrator email for your company."><VerifyEmailResult token={token} /></AuthFrame>;
}
