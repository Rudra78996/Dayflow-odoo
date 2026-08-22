import { AuthFrame } from "@/components/auth-frame";
import { TokenPasswordForm } from "@/components/auth/token-password-form";

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthFrame eyebrow="Welcome to the team" title="Activate your account" description="Choose a strong password to finish accepting your invitation."><TokenPasswordForm token={token} mode="activate" /></AuthFrame>;
}
