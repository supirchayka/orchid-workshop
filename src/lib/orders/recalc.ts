import type { Prisma } from "@prisma/client";

type PricedQuantity = {
  unitPriceCents: number;
  quantity: number;
};

function lineTotal(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}

export async function recalcOrderTotalsTx(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const [worksRaw, partsRaw, expenses] = await Promise.all([
    tx.orderWork.findMany({
      where: { orderId },
      select: {
        unitPriceCents: true,
        quantity: true,
      },
    }),
    tx.orderPart.findMany({
      where: { orderId },
      select: {
        unitPriceCents: true,
        quantity: true,
      },
    }),
    tx.expense.aggregate({
      where: { orderId },
      _sum: {
        amountCents: true,
      },
    }),
  ]);

  const works = worksRaw as PricedQuantity[];
  const parts = partsRaw as PricedQuantity[];

  const laborSubtotalCents = works.reduce((sum: number, item: PricedQuantity) => {
    return sum + lineTotal(item.unitPriceCents, item.quantity);
  }, 0);

  const partsSubtotalCents = parts.reduce((sum: number, item: PricedQuantity) => {
    return sum + lineTotal(item.unitPriceCents, item.quantity);
  }, 0);

  const invoiceTotalCents = laborSubtotalCents + partsSubtotalCents;
  const orderExpensesCents = (expenses._sum.amountCents as number | null) ?? 0;

  await tx.order.update({
    where: { id: orderId },
    data: {
      laborSubtotalCents,
      partsSubtotalCents,
      invoiceTotalCents,
      orderExpensesCents,
    },
  });
}
