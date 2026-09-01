import { ScanClient } from "./ScanClient";
import { listEvents } from "@/services/catalog";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const events = await listEvents();
  return <ScanClient events={events} demoHint={isDemoMode()} />;
}
