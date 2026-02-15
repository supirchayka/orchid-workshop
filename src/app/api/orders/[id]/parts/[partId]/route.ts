import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { assertOrderMutable } from "@/lib/orders/locks";
import { recalcOrderTotalsTx } from "@/lib/orders/recalc";
import { prisma } from "@/lib/prisma";

const updatePartBodySchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название запчасти").max(120, "Максимум 120 символов").optional(),
    unitPriceCents: z.number().int().min(0).optional(),
    quantity: z.number().int().min(1).max(999).optional(),
    costCents: z.union([z.number().int().min(0), z.null()]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Передайте хотя бы одно поле для обновления",
  });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; partId: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;

    const json = await req.json().catch(() => null);
    const parsed = updatePartBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const part = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: routeParams.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const existingPart = await tx.orderPart.findFirst({
        where: { id: routeParams.partId, orderId: order.id },
        select: {
          id: true,
          name: true,
          unitPriceCents: true,
          quantity: true,
          costCents: true,
        },
      });

      if (!existingPart) {
        throw httpError(404, "Запчасть не найдена");
      }

      const nextName = parsed.data.name ?? existingPart.name;
      const nextUnitPriceCents = parsed.data.unitPriceCents ?? existingPart.unitPriceCents;
      const nextQuantity = parsed.data.quantity ?? existingPart.quantity;
      const nextCostCents = parsed.data.costCents !== undefined ? parsed.data.costCents : existingPart.costCents;

      const changed: Record<string, { from: unknown; to: unknown }> = {};

      if (nextName !== existingPart.name) {
        changed.name = { from: existingPart.name, to: nextName };
      }

      if (nextUnitPriceCents !== existingPart.unitPriceCents) {
        changed.unitPriceCents = { from: existingPart.unitPriceCents, to: nextUnitPriceCents };
      }

      if (nextQuantity !== existingPart.quantity) {
        changed.quantity = { from: existingPart.quantity, to: nextQuantity };
      }

      if (nextCostCents !== existingPart.costCents) {
        changed.costCents = { from: existingPart.costCents, to: nextCostCents };
      }

      if (Object.keys(changed).length === 0) {
        return existingPart;
      }

      const updatedPart = await tx.orderPart.update({
        where: { id: existingPart.id },
        data: {
          name: nextName,
          unitPriceCents: nextUnitPriceCents,
          quantity: nextQuantity,
          costCents: nextCostCents,
        },
        select: { id: true },
      });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.ORDER_PART,
          entityId: updatedPart.id,
          orderId: order.id,
          diff: {
            changed,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedPart;
    });

    return Response.json({ ok: true, part });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; partId: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: routeParams.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const existingPart = await tx.orderPart.findFirst({
        where: { id: routeParams.partId, orderId: order.id },
        select: { id: true },
      });

      if (!existingPart) {
        throw httpError(404, "Запчасть не найдена");
      }

      await tx.orderPart.delete({ where: { id: existingPart.id } });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.DELETE,
          entity: AuditEntity.ORDER_PART,
          entityId: existingPart.id,
          orderId: order.id,
          diff: {
            deleted: {
              id: existingPart.id,
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
