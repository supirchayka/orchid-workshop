import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { assertOrderMutable } from "@/lib/orders/locks";
import { prisma } from "@/lib/prisma";

const createCommentBodySchema = z.object({
  text: z.string().trim().min(1, "Введите комментарий").max(2000, "Максимум 2000 символов"),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const routeParams = await params;

    const order = await prisma.order.findUnique({
      where: { id: routeParams.id },
      select: { id: true },
    });

    if (!order) {
      return httpError(404, "Заказ не найден");
    }

    const comments = await prisma.orderComment.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderId: true,
        authorId: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return Response.json({ ok: true, comments });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;

    const json = await req.json().catch(() => null);
    const parsed = createCommentBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: routeParams.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(order);

      const createdComment = await tx.orderComment.create({
        data: {
          orderId: order.id,
          authorId: session.userId,
          text: parsed.data.text,
        },
        select: {
          id: true,
          orderId: true,
          authorId: true,
          text: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.COMMENT,
          entityId: createdComment.id,
          orderId: order.id,
          diff: {
            created: {
              id: createdComment.id,
              orderId: createdComment.orderId,
              authorId: createdComment.authorId,
              text:
                createdComment.text.length > 200
                  ? `${createdComment.text.slice(0, 200)}...`
                  : createdComment.text,
            },
          } as Prisma.InputJsonValue,
        },
      });

      return createdComment;
    });

    return Response.json({ ok: true, comment });
  } catch (e) {
    return toHttpError(e);
  }
}
