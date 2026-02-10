import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { assertOrderMutable } from "@/lib/orders/locks";
import { recalcOrderTotalsTx } from "@/lib/orders/recalc";
import { prisma } from "@/lib/prisma";

const isoDateOrDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
    }

    return !Number.isNaN(new Date(value).getTime());
  }, "Укажите корректную дату")
  .transform((value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }

    return new Date(value);
  });

const createExpenseBodySchema = z.object({
  title: z.string().trim().min(1, "Укажите название расхода").max(160, "Максимум 160 символов"),
  amountCents: z.number().int().positive("Сумма должна быть больше 0"),
  expenseDate: isoDateOrDateTimeSchema.optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const json = await req.json().catch(() => null);
    const parsed = createExpenseBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const expense = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const createdExpense = await tx.expense.create({
        data: {
          orderId: order.id,
          title: parsed.data.title,
          amountCents: parsed.data.amountCents,
          expenseDate: parsed.data.expenseDate ?? new Date(),
          createdById: session.userId,
        },
        select: {
          id: true,
          orderId: true,
          title: true,
          amountCents: true,
          expenseDate: true,
        },
      });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.EXPENSE,
          entityId: createdExpense.id,
          orderId: order.id,
          diff: {
            created: {
              id: createdExpense.id,
              orderId: createdExpense.orderId,
              title: createdExpense.title,
              amountCents: createdExpense.amountCents,
              expenseDate: createdExpense.expenseDate.toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });

      return createdExpense;
    });

    return Response.json({ ok: true, expense: { id: expense.id } });
  } catch (e) {
    return toHttpError(e);
  }
}
