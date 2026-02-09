import * as React from "react";

import { cn } from "@/lib/cn";

export type BadgeVariant = "default" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-white/10 text-zinc-200 border-white/10",
  info: "bg-[rgba(10,132,255,0.2)] text-blue-300 border-blue-300/20",
  success: "bg-emerald-400/15 text-emerald-300 border-emerald-300/20",
  warning: "bg-amber-400/15 text-amber-300 border-amber-300/20",
  danger: "bg-[rgba(255,69,58,0.2)] text-red-300 border-red-300/20",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-[0.15px]",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";
