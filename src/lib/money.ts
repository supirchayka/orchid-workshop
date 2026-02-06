const INVALID_AMOUNT_ERROR = "Некорректная сумма";

function normalizeInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/руб\.?/gu, "")
    .replace(/₽/gu, "")
    .replace(/[\s\u00A0\u202F]/gu, "");
}

function normalizeDecimal(value: string): string {
  const hasDot = value.includes(".");
  const hasComma = value.includes(",");

  if (hasDot && hasComma) {
    const lastDotIndex = value.lastIndexOf(".");
    const lastCommaIndex = value.lastIndexOf(",");

    if (lastDotIndex > lastCommaIndex) {
      return value.replace(/,/gu, "");
    }

    return value.replace(/\./gu, "").replace(",", ".");
  }

  if (hasComma) {
    return value.replace(/,/gu, ".");
  }

  return value;
}

export function formatRub(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(INVALID_AMOUNT_ERROR);
  }

  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const rubles = Math.floor(abs / 100);
  const kopecks = String(abs % 100).padStart(2, "0");
  const groupedRubles = rubles.toLocaleString("ru-RU").replace(/[\u00A0\u202F]/gu, " ");

  return `${sign}${groupedRubles},${kopecks} ₽`;
}

export function parseRubToCents(input: string): number {
  const normalizedInput = normalizeInput(input);
  if (!normalizedInput) {
    throw new Error(INVALID_AMOUNT_ERROR);
  }

  const decimalNormalized = normalizeDecimal(normalizedInput);
  if (!/^\d+(?:\.\d{1,2})?$/u.test(decimalNormalized)) {
    throw new Error(INVALID_AMOUNT_ERROR);
  }

  const [rublesPart, kopecksPart = ""] = decimalNormalized.split(".");
  const rubles = Number(rublesPart);

  if (!Number.isSafeInteger(rubles) || rubles < 0) {
    throw new Error(INVALID_AMOUNT_ERROR);
  }

  const kopecks = Number((kopecksPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(kopecks) || kopecks < 0 || kopecks > 99) {
    throw new Error(INVALID_AMOUNT_ERROR);
  }

  return rubles * 100 + kopecks;
}
