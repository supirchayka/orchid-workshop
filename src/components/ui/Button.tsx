import * as React from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#ff9d2b,#ff8c0f)] text-[#101010] shadow-[0_12px_26px_rgba(0,0,0,0.34)] hover:brightness-[1.03]",
  secondary:
    "bg-[linear-gradient(150deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] text-[var(--text)] backdrop-blur-xl hover:bg-[linear-gradient(150deg,rgba(255,255,255,0.2),rgba(255,255,255,0.07))]",
  ghost: "bg-transparent text-[var(--text)] hover:bg-white/[0.06]",
  danger:
    "bg-[linear-gradient(135deg,rgba(255,107,99,0.88),rgba(255,107,99,0.72))] text-white shadow-[0_16px_32px_rgba(0,0,0,0.45)] hover:brightness-[1.05]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, loading = false, children, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(
          "glass-hover inline-flex items-center justify-center gap-2 rounded-[14px] border-none font-medium active:scale-[0.995] disabled:pointer-events-none disabled:opacity-60",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading ? "..." : children}
      </button>
    );
  },
);
Button.displayName = "Button";
