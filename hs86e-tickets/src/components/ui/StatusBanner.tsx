import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, WifiOff, XCircle } from "lucide-react";

type Tone = "info" | "success" | "warn" | "danger" | "offline";

const icons = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
  offline: WifiOff,
};

export function StatusBanner({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm",
        tone === "info" && "border-gold/20 bg-surface-raised text-ink-muted",
        tone === "success" && "border-emerald-bright/40 bg-emerald/40 text-ink",
        tone === "warn" && "border-gold/40 bg-[#2a2110] text-gold-champagne",
        tone === "danger" && "border-danger-bright/40 bg-danger/30 text-ink",
        tone === "offline" && "border-gold/25 bg-surface-overlay text-gold",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
