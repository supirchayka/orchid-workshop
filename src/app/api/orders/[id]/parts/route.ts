import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { assertOrderMutable } from "@/lib/orders/locks";
import { recalcOrderTotalsTx } from "@/lib/orders/recalc";
import { prisma } from "@/lib/prisma";

const createPartBodySchema = z.object({
  name: z.string().trim().min(1, "Укажите название запчасти").max(120, "Максимум 120 символов"),
  unitPriceCents: z.number().int().min(0),
  quantity: z.number().int().min(1).max(999).default(1),
  costCents: z.number().int().min(0).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const json = await req.json().catch(() => null);
    const parsed = createPartBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const part = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const createdPart = await tx.orderPart.create({
        data: {
          orderId: order.id,
          name: parsed.data.name,
          unitPriceCents: parsed.data.unitPriceCents,
          quantity: parsed.data.quantity,
          costCents: parsed.data.costCents,
        },
      });

      await recalcOrderTotalsTx(tx, order.id);

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.ORDER_PART,
          entityId: createdPart.id,
          orderId: order.id,
          diff: {
            created: {
              id: createdPart.id,
              name: createdPart.name,
              unitPriceCents: createdPart.unitPriceCents,
              quantity: createdPart.quantity,
              ...(createdPart.costCents !== null ? { costCents: createdPart.costCents } : {}),
            },
          } as Prisma.InputJsonValue,
        },
      });

      return createdPart;
    });

    return Response.json({ ok: true, part: { id: part.id } });
  } catch (e) {
    return toHttpError(e);
  }
}
