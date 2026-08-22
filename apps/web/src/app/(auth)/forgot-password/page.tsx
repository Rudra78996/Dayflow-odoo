import { AuthFrame } from "@/components/auth-frame";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return <AuthFrame eyebrow="Account recovery" title="Reset your password" description="Request a short-lived recovery link for your verified work email."><ForgotPasswordForm /></AuthFrame>;
}
