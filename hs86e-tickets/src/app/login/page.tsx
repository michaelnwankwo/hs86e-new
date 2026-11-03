import Link from "next/link";
import { AccountForm } from "@/components/account/AccountForm";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";

export default function LoginPage() {
  return <CustomerAccountProvider><div className="space-y-4 px-4 py-10"><AccountForm mode="login" /><p className="text-center text-sm text-ink-muted">New here? <Link className="text-gold underline" href="/signup">Create an account</Link></p></div></CustomerAccountProvider>;
}
