import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { callWordPressCustomer, CUSTOMER_SESSION_COOKIE, parseAccountSession } from "@/lib/customer-account-proxy";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) redirect("/login");

  let upstream: unknown;
  try {
    upstream = await callWordPressCustomer("session", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect("/login");
    return <div role="alert" className="px-4 py-12 text-center text-ink-muted">Your account service is temporarily unavailable. Please retry shortly.</div>;
  }

  const session = parseAccountSession(upstream);
  if (!session) return <div role="alert" className="px-4 py-12 text-center text-ink-muted">Wallet profile is not available yet. Please retry shortly.</div>;

  return <CustomerAccountProvider initialSession={session}><AccountDashboard /></CustomerAccountProvider>;
}