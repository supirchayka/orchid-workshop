export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function clsxLite(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      continue;
    }

    if (Array.isArray(value)) {
      const nested = clsxLite(...value);
      if (nested) {
        classes.push(nested);
      }
      continue;
    }

    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) {
        classes.push(key);
      }
    }
  }

  return classes.join(" ");
}

function twMergeLite(className: string): string {
  // Lightweight fallback merge: keeps the latest exact token and removes duplicates.
  const unique = new Map<string, string>();

  for (const token of className.split(/\s+/).filter(Boolean)) {
    unique.set(token, token);
  }

  return [...unique.values()].join(" ");
}

export function cn(...classes: ClassValue[]): string {
  return twMergeLite(clsxLite(...classes));
}
