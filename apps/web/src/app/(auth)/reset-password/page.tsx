import { AuthFrame } from "@/components/auth-frame";
import { TokenPasswordForm } from "@/components/auth/token-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthFrame eyebrow="Account recovery" title="Choose a new password" description="This secure link is single-use and expires automatically."><TokenPasswordForm token={token} mode="reset" /></AuthFrame>;
}
