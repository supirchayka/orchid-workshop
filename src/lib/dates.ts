function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateRu(value: string | Date): string {
  const date = toDate(value);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeRu(value: string | Date): string {
  const date = toDate(value);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
