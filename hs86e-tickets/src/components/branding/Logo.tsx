import { LOGO_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "hero" | "splash";

const sizes: Record<Size, string> = {
  sm: "h-9 w-auto",
  md: "h-12 w-auto",
  lg: "h-16 w-auto",
  hero: "h-[168px] w-auto max-w-[86vw] sm:h-[220px]",
  splash: "h-[210px] w-auto max-w-[78vw] sm:h-[260px]",
};

export function Logo({
  size = "md",
  className,
  priority = false,
  alt = "Hot Since 86 Entertainment",
}: {
  size?: Size;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <span className={cn("logo-glow inline-flex items-center justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_PATH}
        alt={alt}
        className={cn("relative z-10 object-contain drop-shadow-[0_0_28px_rgba(223,178,96,0.28)]", sizes[size])}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </span>
  );
}
