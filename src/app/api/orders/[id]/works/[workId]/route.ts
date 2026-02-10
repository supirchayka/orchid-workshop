import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { calcCommissionCents } from "@/lib/orders/commission";
import { assertOrderMutable } from "@/lib/orders/locks";
import { recalcOrderTotalsTx } from "@/lib/orders/recalc";
import { prisma } from "@/lib/prisma";

const updateWorkBodySchema = z
  .object({
    serviceName: z.string().trim().min(1, "Укажите название работы").max(80, "Максимум 80 символов").optional(),
    unitPriceCents: z.number().int().min(0).optional(),
    quantity: z.number().int().min(1).max(999).optional(),
    performerId: z.string().trim().min(1, "performerId обязателен").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Передайте хотя бы одно поле для обновления",
  });

export async function PATCH(req: Request, { params }: { params: { id: string; workId: string } }) {
  try {
    const session = await requireSession();

    const json = await req.json().catch(() => null);
    const parsed = updateWorkBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const work = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const existingWork = await tx.orderWork.findFirst({
        where: { id: params.workId, orderId: order.id },
        select: {
          id: true,
          orderId: true,
          serviceId: true,
          serviceName: true,
          unitPriceCents: true,
          quantity: true,
          performerId: true,
          commissionPctSnapshot: true,
          commissionCentsSnapshot: true,
        },
      });

      if (!existingWork) {
        throw httpError(404, "Работа не найдена");
      }

      if (parsed.data.serviceName !== undefined && existingWork.serviceId !== null) {
        throw httpError(409, "Название можно менять только у кастомной работы");
      }

      let nextPerformerId = existingWork.performerId;
      let nextCommissionPctSnapshot = existingWork.commissionPctSnapshot;

      if (parsed.data.performerId !== undefined && parsed.data.performerId !== existingWork.performerId) {
        const performer = await tx.user.findUnique({
          where: { id: parsed.data.performerId },
          select: { id: true, isActive: true, commissionPct: true },
        });

        if (!performer) {
          throw httpError(404, "Исполнитель не найден");
        }

        if (!performer.isActive) {
          throw httpError(409, "Исполнитель неактивен");
        }

        nextPerformerId = performer.id;
        nextCommissionPctSnapshot = performer.commissionPct;
      }

      const nextServiceName = parsed.data.serviceName ?? existingWork.serviceName;
      const nextUnitPriceCents = parsed.data.unitPriceCents ?? existingWork.unitPriceCents;
      const nextQuantity = parsed.data.quantity ?? existingWork.quantity;
      const lineTotalCents = nextUnitPriceCents * nextQuantity;
      const nextCommissionCentsSnapshot = calcCommissionCents(lineTotalCents, nextCommissionPctSnapshot);

      const changed: Record<string, { from: unknown; to: unknown }> = {};

      if (nextServiceName !== existingWork.serviceName) {
        changed.serviceName = { from: existingWork.serviceName, to: nextServiceName };
      }

      if (nextUnitPriceCents !== existingWork.unitPriceCents) {
        changed.unitPriceCents = { from: existingWork.unitPriceCents, to: nextUnitPriceCents };
      }

      if (nextQuantity !== existingWork.quantity) {
        changed.quantity = { from: existingWork.quantity, to: nextQuantity };
      }

      if (nextPerformerId !== existingWork.performerId) {
        changed.performerId = { from: existingWork.performerId, to: nextPerformerId };
      }

      if (nextCommissionPctSnapshot !== existingWork.commissionPctSnapshot) {
        changed.commissionPctSnapshot = {
          from: existingWork.commissionPctSnapshot,
          to: nextCommissionPctSnapshot,
        };
      }

      if (nextCommissionCentsSnapshot !== existingWork.commissionCentsSnapshot) {
        changed.commissionCentsSnapshot = {
          from: existingWork.commissionCentsSnapshot,
          to: nextCommissionCentsSnapshot,
        };
      }

      if (Object.keys(changed).length === 0) {
        return existingWork;
      }

      const updatedWork = await tx.orderWork.update({
        where: { id: existingWork.id },
        data: {
          serviceName: nextServiceName,
          unitPriceCents: nextUnitPriceCents,
          quantity: nextQuantity,
          performerId: nextPerformerId,
          commissionPctSnapshot: nextCommissionPctSnapshot,
          commissionCentsSnapshot: nextCommissionCentsSnapshot,
        },
      });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.ORDER_WORK,
          entityId: updatedWork.id,
          orderId: order.id,
          diff: {
            changed,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedWork;
    });

    return Response.json({ ok: true, work });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; workId: string } }) {
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

      const existingWork = await tx.orderWork.findFirst({
        where: { id: params.workId, orderId: order.id },
        select: { id: true },
      });

      if (!existingWork) {
        throw httpError(404, "Работа не найдена");
      }

      await tx.orderWork.delete({ where: { id: existingWork.id } });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.DELETE,
          entity: AuditEntity.ORDER_WORK,
          entityId: existingWork.id,
          orderId: order.id,
          diff: {
            deleted: {
              id: existingWork.id,
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
