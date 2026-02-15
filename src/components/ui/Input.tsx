import * as React from "react";

import { cn } from "@/lib/cn";

const fieldBaseClass =
  "w-full rounded-[14px] border-none bg-[linear-gradient(160deg,rgba(16,18,23,0.92),rgba(10,12,15,0.88))] px-3.5 text-[15px] text-[var(--text)] outline-none backdrop-blur-xl transition placeholder:text-[var(--muted-2)] focus:shadow-[0_0_0_3px_var(--accent-soft)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(fieldBaseClass, "h-11", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(fieldBaseClass, "min-h-24 py-3", className)} {...props} />
));
TextArea.displayName = "TextArea";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("mb-1.5 block text-xs font-medium tracking-[0.2px] text-[var(--muted)]", className)} {...props} />
  ),
);
Label.displayName = "Label";

export const HelperText = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("mt-1 text-xs text-[var(--muted-2)]", className)} {...props} />
  ),
);
HelperText.displayName = "HelperText";

export const ErrorText = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("mt-1 text-xs text-[var(--danger)]", className)} {...props} />
  ),
);
ErrorText.displayName = "ErrorText";
