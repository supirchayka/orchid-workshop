import * as React from "react";

import { cn } from "@/lib/cn";

export type BadgeVariant = "default" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-white/12 text-[var(--text)]",
  info: "bg-[linear-gradient(135deg,rgba(81,130,255,0.34),rgba(81,130,255,0.2))] text-[#e4edff]",
  success: "bg-[linear-gradient(135deg,rgba(40,182,114,0.34),rgba(40,182,114,0.2))] text-[#ddfff0]",
  warning: "bg-[linear-gradient(135deg,rgba(255,140,15,0.42),rgba(255,140,15,0.24))] text-[#fff2de]",
  danger: "bg-[linear-gradient(135deg,rgba(255,92,110,0.4),rgba(255,92,110,0.24))] text-[#ffe1e5]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border-none px-2.5 py-0.5 text-xs font-medium tracking-[0.15px] backdrop-blur-xl",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";
