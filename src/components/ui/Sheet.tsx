"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(): SheetContextValue {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within <Sheet>");
  }
  return context;
}

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, defaultOpen = false, onOpenChange, children }: SheetProps): React.JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  return <SheetContext.Provider value={{ open: isOpen, setOpen }}>{children}</SheetContext.Provider>;
}

interface SheetTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  asChild?: boolean;
  children: React.ReactNode | ((controls: { open: boolean; setOpen: (open: boolean) => void }) => React.ReactNode);
}

export function SheetTrigger({ asChild = false, children, onClick, ...props }: SheetTriggerProps): React.JSX.Element {
  const { open, setOpen } = useSheetContext();

  if (typeof children === "function") {
    return <>{children({ open, setOpen })}</>;
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;
    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(true);
        }
      },
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "bottom" | "right";
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "bottom", children, ...props }, ref) => {
    const { open, setOpen } = useSheetContext();

    if (!open) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Закрыть"
          className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-[1px] animate-in fade-in-0 duration-200"
          onClick={() => setOpen(false)}
        />

        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            "ios-card absolute border border-white/10 p-5 duration-200 ease-out",
            side === "bottom" &&
              "bottom-0 left-0 right-0 rounded-b-none rounded-t-[24px] animate-in slide-in-from-bottom-8 fade-in-0",
            side === "right" &&
              "right-0 top-0 h-full w-full max-w-md rounded-l-[24px] rounded-r-none animate-in slide-in-from-right-12 fade-in-0",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);
SheetContent.displayName = "SheetContent";

export const SheetHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("mb-4 space-y-1", className)} {...props} />,
);
SheetHeader.displayName = "SheetHeader";

export const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
  ),
);
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-zinc-400", className)} {...props} />,
);
SheetDescription.displayName = "SheetDescription";

export const SheetFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-5 flex items-center justify-end gap-2", className)} {...props} />
  ),
);
SheetFooter.displayName = "SheetFooter";
