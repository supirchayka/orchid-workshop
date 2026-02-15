import { httpError } from "@/lib/http/errors";

export function parseRouteInt(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw httpError(400, `Некорректный параметр ${fieldName}`);
  }

  return parsed;
}
