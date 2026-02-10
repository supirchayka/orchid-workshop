import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
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

const filterDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Используйте формат YYYY-MM-DD")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const createExpenseBodySchema = z.object({
  title: z.string().trim().min(1, "Укажите название расхода").max(160, "Максимум 160 символов"),
  amountCents: z.number().int().positive("Сумма должна быть больше 0"),
  expenseDate: isoDateOrDateTimeSchema.optional(),
});

const listQuerySchema = z
  .object({
    from: filterDateSchema.optional(),
    to: filterDateSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(), {
    message: "Параметр from не может быть больше to",
    path: ["from"],
  });

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const { searchParams } = new URL(req.url);
    const parsedQuery = listQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    if (!parsedQuery.success) {
      return httpError(400, "Неверные данные", { issues: parsedQuery.error.issues });
    }

    const from = parsedQuery.data.from;
    const to = parsedQuery.data.to;

    const expenses = await prisma.expense.findMany({
      where: {
        orderId: null,
        expenseDate: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) } : {}),
        },
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        amountCents: true,
        expenseDate: true,
        createdBy: {
          select: {
            name: true,
          },
        },
      },
    });

    return Response.json({ ok: true, expenses });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const json = await req.json().catch(() => null);
    const parsed = createExpenseBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const expense = await prisma.expense.create({
      data: {
        orderId: null,
        title: parsed.data.title,
        amountCents: parsed.data.amountCents,
        expenseDate: parsed.data.expenseDate ?? new Date(),
        createdById: session.userId,
      },
      select: {
        id: true,
        title: true,
        amountCents: true,
        expenseDate: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.EXPENSE,
        entityId: expense.id,
        orderId: null,
        diff: {
          created: {
            id: expense.id,
            orderId: null,
            title: expense.title,
            amountCents: expense.amountCents,
            expenseDate: expense.expenseDate.toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });

    return Response.json({ ok: true, expense: { id: expense.id } });
  } catch (e) {
    return toHttpError(e);
  }
}
