import { AuthFrame } from "@/components/auth-frame";
import { CompanySignUpForm } from "@/components/auth/company-sign-up-form";

export default function SignUpPage() {
  return <AuthFrame eyebrow="Start with Dayflow" title="Create your company" description="Set up the first administrator. You can invite the rest of your team next."><CompanySignUpForm /></AuthFrame>;
}
