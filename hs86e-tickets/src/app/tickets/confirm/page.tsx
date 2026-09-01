import { redirect } from "next/navigation";

export default async function TicketConfirmRedirect({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const q = await searchParams;
  const order = q.order ?? "";
  const key = q.key ?? "";
  const qs = new URLSearchParams();
  if (order) qs.set("order", order);
  if (key) qs.set("key", key);
  redirect(`/checkout/success?${qs.toString()}`);
}
