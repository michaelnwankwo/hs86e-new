"use client";

import { ScannerView } from "@/components/scanner/ScannerView";
import { ScannerAuthGuard } from "@/components/scanner/ScannerAuthGuard";
import type { EventProduct } from "@/lib/types";

export function ScanClient({ events, demoHint }: { events: EventProduct[]; demoHint: boolean }) {
  return (
    <ScannerAuthGuard demoHint={demoHint}>
      <ScannerView events={events} />
    </ScannerAuthGuard>
  );
}
