import { BRAND } from "@/lib/constants";

export function AppFooter() {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-4 pt-8 text-center text-[11px] uppercase tracking-[0.16em] text-ink-dim">
      {BRAND.legalName} · {BRAND.documentId}
    </footer>
  );
}
