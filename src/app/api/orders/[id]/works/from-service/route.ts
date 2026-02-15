import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { calcCommissionCents } from "@/lib/orders/commission";
import { assertOrderMutable } from "@/lib/orders/locks";
import { recalcOrderTotalsTx } from "@/lib/orders/recalc";
import { prisma } from "@/lib/prisma";

const createWorkFromServiceBodySchema = z.object({
  serviceId: z.string().trim().min(1, "serviceId обязателен"),
  performerId: z.string().trim().min(1, "performerId обязателен"),
  unitPriceCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).max(999).default(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;

    const json = await req.json().catch(() => null);
    const parsed = createWorkFromServiceBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const { serviceId, performerId, quantity } = parsed.data;

    const work = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: routeParams.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const service = await tx.service.findUnique({
        where: { id: serviceId },
        select: { id: true, name: true, defaultPriceCents: true },
      });

      if (!service) {
        throw httpError(404, "Услуга не найдена");
      }

      const performer = await tx.user.findUnique({
        where: { id: performerId },
        select: { id: true, isActive: true, commissionPct: true },
      });

      if (!performer) {
        throw httpError(404, "Исполнитель не найден");
      }

      if (!performer.isActive) {
        throw httpError(409, "Исполнитель неактивен");
      }

      const unitPriceCents = parsed.data.unitPriceCents ?? service.defaultPriceCents;
      const commissionPctSnapshot = performer.commissionPct;
      const lineTotalCents = unitPriceCents * quantity;
      const commissionCentsSnapshot = calcCommissionCents(lineTotalCents, commissionPctSnapshot);

      const createdWork = await tx.orderWork.create({
        data: {
          orderId: order.id,
          serviceId: service.id,
          serviceName: service.name,
          unitPriceCents,
          quantity,
          performerId: performer.id,
          commissionPctSnapshot,
          commissionCentsSnapshot,
        },
      });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.ORDER_WORK,
          entityId: createdWork.id,
          orderId: order.id,
          diff: {
            created: {
              id: createdWork.id,
              serviceName: createdWork.serviceName,
              unitPriceCents: createdWork.unitPriceCents,
              quantity: createdWork.quantity,
              performerId: createdWork.performerId,
              commissionPctSnapshot: createdWork.commissionPctSnapshot,
              commissionCentsSnapshot: createdWork.commissionCentsSnapshot,
            },
          } as Prisma.InputJsonValue,
        },
      });

      return createdWork;
    });

    return Response.json({ ok: true, work });
  } catch (e) {
    return toHttpError(e);
  }
}
