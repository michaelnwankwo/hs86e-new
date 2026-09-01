"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "gold" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-emerald text-ink shadow-emerald hover:bg-emerald-mid active:bg-emerald-bright disabled:opacity-50",
  gold:
    "bg-gold text-[#1a1408] hover:bg-gold-champagne active:bg-gold-metallic disabled:opacity-50",
  ghost:
    "bg-transparent text-gold border border-gold/30 hover:bg-gold/10 disabled:opacity-50",
  danger:
    "bg-danger text-ink hover:bg-danger-bright disabled:opacity-50",
};

export function Button({
  variant = "primary",
  block,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold tracking-wide transition",
        block && "w-full",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
