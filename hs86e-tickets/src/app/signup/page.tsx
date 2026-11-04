import Link from "next/link";
import { AccountForm } from "@/components/account/AccountForm";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";

export default function SignupPage() {
  return (
    <CustomerAccountProvider>
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-[#0B0E14]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 78% 54% at 50% 0%, rgba(223, 178, 96, 0.16), transparent 62%), radial-gradient(ellipse 55% 42% at 88% 100%, rgba(212, 175, 55, 0.08), transparent 68%)",
          }}
        />
        <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-4">
            <AccountForm mode="signup" />
            <p className="text-center text-sm text-ink-muted">
              Already have an account?{" "}
              <Link className="text-gold underline" href="/login">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </>
    </CustomerAccountProvider>
  );
}
