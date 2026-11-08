import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { GuestAccountPanel } from "@/components/account/GuestAccountPanel";
import { AccountProxyError, callWordPressCustomer, CUSTOMER_SESSION_COOKIE, parseAccountSession } from "@/lib/customer-account-proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Account | Hot Since 86",
  description: "View your tickets, order history and wallet details.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;

  // Guest visit (or right after sign-out cleared the cookie): luxury fallback
  // with Sign In / Register — never a frozen shell, never a redirect loop.
  if (!token) {
    return <GuestAccountPanel />;
  }

  try {
    const upstream = await callWordPressCustomer("session", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const session = parseAccountSession(upstream);
    if (!session) {
      return <GuestAccountPanel notice="Wallet profile is not available yet. Please retry shortly." />;
    }
    return (
      <CustomerAccountProvider initialSession={session}>
        <AccountDashboard />
      </CustomerAccountProvider>
    );
  } catch (error) {
    const status = error instanceof AccountProxyError ? error.status : undefined;
    if (status === 401) {
      // Cookie is stale (already cleared or WP no longer honours it).
      return <GuestAccountPanel notice="Your session has expired. Sign in again to view your account." />;
    }
    return (
      <GuestAccountPanel notice="Your account service is temporarily unavailable. Please retry shortly, or browse events while you wait." />
    );
  }
}