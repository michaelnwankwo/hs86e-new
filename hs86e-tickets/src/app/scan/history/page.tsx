import type { Metadata } from "next";
import { HistoryClient } from "./HistoryClient";

/** Staff-only surface — excluded from search and the public sitemap. */
export const metadata: Metadata = {
  title: "Scan History | Hot Since 86",
  robots: { index: false, follow: false },
};

export default function ScanHistoryPage() {
  return <HistoryClient />;
}
