import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { parseRouteInt } from "@/lib/http/ids";
import { calcCommissionCents } from "@/lib/orders/commission";
import { assertOrderMutable } from "@/lib/orders/locks";
import { recalcOrderTotalsTx } from "@/lib/orders/recalc";
import { prisma } from "@/lib/prisma";

const createCustomWorkBodySchema = z.object({
  serviceName: z.string().trim().min(1, "Укажите название работы").max(80, "Максимум 80 символов"),
  performerId: z.coerce.number().int().positive("performerId is required"),
  unitPriceCents: z.number().int().min(0),
  quantity: z.number().int().min(1).max(999).default(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;
    const orderId = parseRouteInt(routeParams.id, "id");

    const json = await req.json().catch(() => null);
    const parsed = createCustomWorkBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const { serviceName, performerId, unitPriceCents, quantity } = parsed.data;

    const work = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const performer = await tx.user.findUnique({
        where: { id: performerId },
        select: { id: true, isActive: true, isAdmin: true, commissionPct: true },
      });

      if (!performer) {
        throw httpError(404, "Исполнитель не найден");
      }

      if (!performer.isActive) {
        throw httpError(409, "Исполнитель неактивен");
      }

      const commissionPctSnapshot = performer.isAdmin ? 0 : performer.commissionPct;
      const lineTotalCents = unitPriceCents * quantity;
      const commissionCentsSnapshot = calcCommissionCents(lineTotalCents, commissionPctSnapshot);

      const createdWork = await tx.orderWork.create({
        data: {
          orderId: order.id,
          serviceId: null,
          serviceName,
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
