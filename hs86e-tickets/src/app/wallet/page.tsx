import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AccountProxyError, callWordPressCustomer, CUSTOMER_SESSION_COOKIE, parseAccountSession } from "@/lib/customer-account-proxy";
import { GuestAccountPanel } from "@/components/account/GuestAccountPanel";
import { WalletScreen } from "@/components/wallet/WalletScreen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Wallet | Hot Since 86",
  description: "Top up your HS86E Wallet, withdraw to your bank, and review every ledger entry — NGN only, secured server-side.",
  robots: { index: false, follow: false },
};

export default async function WalletPage() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;

  if (!token) {
    return <GuestAccountPanel notice="Sign in to open your wallet." />;
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
    return <WalletScreen />;
  } catch (error) {
    const status = error instanceof AccountProxyError ? error.status : undefined;
    if (status === 401) {
      return <GuestAccountPanel notice="Your session has expired. Sign in again to open your wallet." />;
    }
    return <GuestAccountPanel notice="Your account service is temporarily unavailable. Please retry shortly, or browse events while you wait." />;
  }
}
