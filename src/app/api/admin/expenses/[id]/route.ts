import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { parseRouteInt } from "@/lib/http/ids";
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;
    const expenseId = parseRouteInt(routeParams.id, "id");
    requireAdmin(session);

    const json = await req.json().catch(() => null);
    const parsed = updateExpenseBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const expense = await prisma.$transaction(async (tx) => {
      const existingExpense = await tx.expense.findFirst({
        where: { id: expenseId, orderId: null },
        select: {
          id: true,
          title: true,
          amountCents: true,
          expenseDate: true,
        },
      });

      if (!existingExpense) {
        throw httpError(404, "Расход не найден");
      }

      const nextTitle = parsed.data.title ?? existingExpense.title;
      const nextAmountCents = parsed.data.amountCents ?? existingExpense.amountCents;
      const nextExpenseDate = parsed.data.expenseDate ?? existingExpense.expenseDate;

      const changed: Record<string, { from: unknown; to: unknown }> = {};

      if (nextTitle !== existingExpense.title) {
        changed.title = { from: existingExpense.title, to: nextTitle };
      }

      if (nextAmountCents !== existingExpense.amountCents) {
        changed.amountCents = { from: existingExpense.amountCents, to: nextAmountCents };
      }

      if (nextExpenseDate.getTime() !== existingExpense.expenseDate.getTime()) {
        changed.expenseDate = {
          from: existingExpense.expenseDate.toISOString(),
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

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.EXPENSE,
          entityId: updatedExpense.id,
          orderId: null,
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;
    const expenseId = parseRouteInt(routeParams.id, "id");
    requireAdmin(session);

    await prisma.$transaction(async (tx) => {
      const existingExpense = await tx.expense.findFirst({
        where: { id: expenseId, orderId: null },
        select: { id: true },
      });

      if (!existingExpense) {
        throw httpError(404, "Расход не найден");
      }

      await tx.expense.delete({ where: { id: existingExpense.id } });

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.DELETE,
          entity: AuditEntity.EXPENSE,
          entityId: existingExpense.id,
          orderId: null,
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
