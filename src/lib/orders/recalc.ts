import type { Prisma } from "@prisma/client";

/**
 * Пересчитывает и обновляет денормализованные totals заказа внутри текущей транзакции.
 */
export async function recalcOrderTotalsTx(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const [works, parts, expenses] = await Promise.all([
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

  const laborSubtotalCents = works.reduce((sum: number, item: { unitPriceCents: number; quantity: number }) => {
    return sum + item.unitPriceCents * item.quantity;
  }, 0);

  const partsSubtotalCents = parts.reduce((sum: number, item: { unitPriceCents: number; quantity: number }) => {
    return sum + item.unitPriceCents * item.quantity;
  }, 0);

  const invoiceTotalCents = laborSubtotalCents + partsSubtotalCents;
  const orderExpensesCents = expenses._sum.amountCents ?? 0;

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
