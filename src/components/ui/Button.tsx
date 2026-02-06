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
    "bg-[var(--accent)] text-white border border-white/10 shadow-[0_12px_28px_rgba(10,132,255,0.22)] hover:brightness-105",
  secondary: "bg-[var(--surface-2)] text-[var(--text)] border border-white/10 hover:bg-white/10",
  ghost: "bg-transparent text-[var(--text)] border border-transparent hover:bg-white/10",
  danger:
    "bg-[var(--danger)] text-white border border-red-200/20 shadow-[0_12px_28px_rgba(255,69,58,0.2)] hover:brightness-105",
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
          "inline-flex items-center justify-center gap-2 rounded-[14px] font-medium transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading ? "…" : children}
      </button>
    );
  },
);
Button.displayName = "Button";
