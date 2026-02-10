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

const updateExpenseBodySchema = z
  .object({
    title: z.string().trim().min(1, "Укажите название расхода").max(160, "Максимум 160 символов").optional(),
    amountCents: z.number().int().positive("Сумма должна быть больше 0").optional(),
    expenseDate: isoDateOrDateTimeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Передайте хотя бы одно поле для обновления",
  });

export async function PATCH(req: Request, { params }: { params: { id: string; expenseId: string } }) {
  try {
    const session = await requireSession();

    const json = await req.json().catch(() => null);
    const parsed = updateExpenseBodySchema.safeParse(json);

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

      const existingExpense = await tx.expense.findFirst({
        where: { id: params.expenseId, orderId: order.id },
        select: {
          id: true,
          title: true,
          amountCents: true,
          expenseDate: true,
          createdById: true,
        },
      });

      if (!existingExpense) {
        throw httpError(404, "Расход не найден");
      }

      if (!session.isAdmin && existingExpense.createdById !== session.userId) {
        throw httpError(403, "Недостаточно прав");
      }

      const before = {
        title: existingExpense.title,
        amountCents: existingExpense.amountCents,
        expenseDate: existingExpense.expenseDate,
      };

      const nextTitle = parsed.data.title ?? existingExpense.title;
      const nextAmountCents = parsed.data.amountCents ?? existingExpense.amountCents;
      const nextExpenseDate = parsed.data.expenseDate ?? existingExpense.expenseDate;

      const changed: Record<string, { from: unknown; to: unknown }> = {};

      if (nextTitle !== before.title) {
        changed.title = { from: before.title, to: nextTitle };
      }

      if (nextAmountCents !== before.amountCents) {
        changed.amountCents = { from: before.amountCents, to: nextAmountCents };
      }

      if (nextExpenseDate.getTime() !== before.expenseDate.getTime()) {
        changed.expenseDate = {
          from: before.expenseDate.toISOString(),
          to: nextExpenseDate.toISOString(),
        };
      }

      if (Object.keys(changed).length === 0) {
        return { id: existingExpense.id };
      }

      const updatedExpense = await tx.expense.update({
        where: { id: existingExpense.id },
        data: {
          title: nextTitle,
          amountCents: nextAmountCents,
          expenseDate: nextExpenseDate,
        },
        select: { id: true },
      });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.EXPENSE,
          entityId: updatedExpense.id,
          orderId: order.id,
          diff: {
            changed,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedExpense;
    });

    return Response.json({ ok: true, expense });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; expenseId: string } }) {
  try {
    const session = await requireSession();

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const existingExpense = await tx.expense.findFirst({
        where: { id: params.expenseId, orderId: order.id },
        select: { id: true, createdById: true },
      });

      if (!existingExpense) {
        throw httpError(404, "Расход не найден");
      }

      if (!session.isAdmin && existingExpense.createdById !== session.userId) {
        throw httpError(403, "Недостаточно прав");
      }

      await tx.expense.delete({ where: { id: existingExpense.id } });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.DELETE,
          entity: AuditEntity.EXPENSE,
          entityId: existingExpense.id,
          orderId: order.id,
          diff: {
            deleted: {
              id: existingExpense.id,
            },
          } as Prisma.InputJsonValue,
        },
      });
    });

    return Response.json({ ok: true });
  } catch (e) {
    return toHttpError(e);
  }
}
