import * as React from "react";

import { parseRubToCents } from "@/lib/money";

import { HelperText, Input } from "./Input";

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  onChangeCents?: (cents: number) => void;
  onParseError?: (message: string | null) => void;
}

export function MoneyInput({
  value,
  onValueChange,
  onChangeCents,
  onParseError,
  ...props
}: MoneyInputProps): React.JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const nextValue = event.target.value;
    onValueChange(nextValue);

    if (!nextValue.trim()) {
      onParseError?.(null);
      return;
    }

    try {
      const cents = parseRubToCents(nextValue);
      onChangeCents?.(cents);
      onParseError?.(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Некорректная сумма";
      onParseError?.(message);
    }
  };

  return (
    <div className="space-y-1">
      <Input {...props} inputMode="decimal" value={value} onChange={handleChange} />
      <HelperText>руб.</HelperText>
    </div>
  );
}
