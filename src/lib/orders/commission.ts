import type { Prisma } from "@prisma/client";

function toSafeNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

/**
 * Считает сумму строки работ и гарантирует неотрицательный результат.
 */
export function calcLineTotalCents(unitPriceCents: number, qty: number): number {
  const safePrice = toSafeNonNegative(unitPriceCents);
  const safeQty = toSafeNonNegative(qty);

  return Math.floor(safePrice * safeQty);
}

/**
 * Считает комиссию в центах по формуле floor(lineTotal * pct / 100).
 */
export function calcCommissionCents(lineTotalCents: number, pct: number): number {
  const safeLineTotal = toSafeNonNegative(lineTotalCents);
  const safePct = toSafeNonNegative(pct);

  return Math.floor((safeLineTotal * safePct) / 100);
}

/**
 * Пересчитывает и обновляет commissionCentsSnapshot для строки работ в транзакции.
 */
export async function recalcWorkCommissionTx(tx: Prisma.TransactionClient, workId: string): Promise<void> {
  const work = await tx.orderWork.findUnique({
    where: { id: workId },
    select: {
      unitPriceCents: true,
      quantity: true,
      commissionPctSnapshot: true,
    },
  });

  if (!work) {
    return;
  }

  const lineTotalCents = calcLineTotalCents(work.unitPriceCents, work.quantity);
  const commissionCentsSnapshot = calcCommissionCents(lineTotalCents, work.commissionPctSnapshot);

  await tx.orderWork.update({
    where: { id: workId },
    data: {
      commissionCentsSnapshot,
    },
  });
}
