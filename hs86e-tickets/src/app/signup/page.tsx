import Link from "next/link";
import { AccountForm } from "@/components/account/AccountForm";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";
import { GoldParticleField } from "@/components/layout/GoldParticleField";

export default function SignupPage() {
  return (
    <CustomerAccountProvider>
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0A0D14]"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[position:top_center] bg-no-repeat"
            style={{
              backgroundImage: "url(/images/header-burst.jpg)",
              backgroundSize: "100% 200%",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-black/60" />
          <GoldParticleField className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
        </div>

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
