import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-gold", className)} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">{label}</span>
    </span>
  );
}
