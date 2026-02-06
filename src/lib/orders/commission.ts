import type { Prisma } from "@prisma/client";

function toSafeNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

export function calcLineTotalCents(unitPriceCents: number, qty: number): number {
  const safePrice = toSafeNumber(unitPriceCents);
  const safeQty = toSafeNumber(qty);

  return Math.floor(safePrice * safeQty);
}

export function calcCommissionCents(lineTotalCents: number, pct: number): number {
  const safeLineTotal = toSafeNumber(lineTotalCents);
  const safePct = toSafeNumber(pct);

  return Math.floor((safeLineTotal * safePct) / 100);
}

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
