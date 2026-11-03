import Link from "next/link";
import { AccountForm } from "@/components/account/AccountForm";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";

export default function SignupPage() {
  return <CustomerAccountProvider><div className="space-y-4 px-4 py-10"><AccountForm mode="signup" /><p className="text-center text-sm text-ink-muted">Already have an account? <Link className="text-gold underline" href="/login">Sign in</Link></p></div></CustomerAccountProvider>;
}