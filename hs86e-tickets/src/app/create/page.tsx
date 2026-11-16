import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AccountProxyError, callWordPressCustomer, CUSTOMER_SESSION_COOKIE, parseAccountSession } from "@/lib/customer-account-proxy";
import { GuestAccountPanel } from "@/components/account/GuestAccountPanel";
import { CreateEventScreen } from "@/components/create/CreateEventScreen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Create an event | Hot Since 86",
  description: "Publish your event to Hot Since 86 in four steps. Reviewed before it goes live; one publishing fee paid from your wallet.",
  robots: { index: false, follow: false },
};

export default async function CreatePage() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;

  if (!token) {
    return <GuestAccountPanel notice="Sign in to create an event." />;
  }
  try {
    const upstream = await callWordPressCustomer("session", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const session = parseAccountSession(upstream);
    if (!session) {
      return <GuestAccountPanel notice="Your creator profile is not available yet. Please retry shortly." />;
    }
    return <CreateEventScreen />;
  } catch (error) {
    const status = error instanceof AccountProxyError ? error.status : undefined;
    if (status === 401) {
      return <GuestAccountPanel notice="Your session has expired. Sign in again to create an event." />;
    }
    return <GuestAccountPanel notice="Your account service is temporarily unavailable. Please retry shortly, or browse events while you wait." />;
  }
}
