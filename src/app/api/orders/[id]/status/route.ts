import { AuditAction, AuditEntity, OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit/writeAudit";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { assertStatusChangeAllowed } from "@/lib/orders/locks";
import { prisma } from "@/lib/prisma";

const updateOrderStatusBodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;

    const json = await req.json().catch(() => null);
    const parsed = updateOrderStatusBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const order = await prisma.order.findUnique({
      where: { id: routeParams.id },
      select: {
        id: true,
        status: true,
        paidAt: true,
      },
    });

    if (!order) {
      return httpError(404, "Заказ не найден");
    }

    const newStatus = parsed.data.status;
    assertStatusChangeAllowed({
      isAdmin: session.isAdmin,
      currentStatus: order.status,
      newStatus,
    });

    const nextPaidAt = newStatus === OrderStatus.PAID ? new Date() : null;

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        paidAt: nextPaidAt,
      },
      select: {
        id: true,
        status: true,
        paidAt: true,
      },
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.STATUS_CHANGE,
      entity: AuditEntity.ORDER,
      entityId: order.id,
      orderId: order.id,
      diff: {
        changed: {
          status: { from: order.status, to: updatedOrder.status },
          paidAt: { from: order.paidAt, to: updatedOrder.paidAt },
        },
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, order: updatedOrder });
  } catch (e) {
    return toHttpError(e);
  }
}
