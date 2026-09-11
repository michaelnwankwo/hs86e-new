import { ScanClient } from "./ScanClient";
import { listEvents } from "@/services/catalog";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  // The scanner must always boot: fall back to an empty event list so door
  // staff get the PIN gate even if the catalog/environnment is misconfigured.
  const events = await listEvents().catch((err) => {
    console.error("[hs86e] /scan rendered with an empty event list:", err);
    return [];
  });
  return <ScanClient events={events} demoHint={isDemoMode()} />;
}
