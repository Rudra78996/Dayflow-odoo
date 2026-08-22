import { AuthFrame } from "@/components/auth-frame";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return <AuthFrame eyebrow="Welcome back" title="Sign in to your workday" description="Use your company email or the Login ID provided by your administrator."><SignInForm /></AuthFrame>;
}
