"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

interface TabsContextValue {
  activeValue: string;
  setActiveValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs>");
  }
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({ value, defaultValue, onValueChange, className, ...props }: TabsProps): React.JSX.Element {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);

  const activeValue = value ?? uncontrolledValue;

  const setActiveValue = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider value={{ activeValue, setActiveValue }}>
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  );
}

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-11 w-full items-center rounded-[16px] border-none bg-[linear-gradient(150deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-1 backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { activeValue, setActiveValue } = useTabsContext();
    const isActive = activeValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? "active" : "inactive"}
        className={cn(
          "glass-hover flex-1 rounded-xl border-none px-3 py-2 text-sm font-medium text-[var(--muted)]",
          isActive &&
            "bg-[linear-gradient(140deg,rgba(255,140,15,0.26),rgba(255,140,15,0.12))] text-[var(--text)] shadow-[0_10px_24px_rgba(3,10,18,0.3)]",
          className,
        )}
        onClick={() => setActiveValue(value)}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { activeValue } = useTabsContext();

    if (activeValue !== value) {
      return null;
    }

    return <div ref={ref} role="tabpanel" className={cn("mt-4", className)} {...props} />;
  },
);
TabsContent.displayName = "TabsContent";
