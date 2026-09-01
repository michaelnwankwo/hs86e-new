import type { CatalogResult } from "@/services/catalog";

export function CatalogBanner({ catalog }: { catalog: CatalogResult }) {
  if (catalog.source === "wordpress" && catalog.error) {
    return (
      <div className="mb-4 rounded-xl border border-danger-bright/40 bg-danger/20 px-3 py-3 text-sm text-ink">
        WordPress catalog failed: {catalog.error}
      </div>
    );
  }
  return null;
}
