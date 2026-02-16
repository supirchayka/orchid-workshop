import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { parseRouteInt } from "@/lib/http/ids";
import { assertOrderMutable } from "@/lib/orders/locks";
import { prisma } from "@/lib/prisma";

const updateOrderBodySchema = z
  .object({
    title: z.string().trim().min(1, "Укажите название").max(80, "Максимум 80 символов").optional(),
    guitarSerial: z.string().trim().max(80, "Максимум 80 символов").optional(),
    description: z.string().trim().max(2000, "Максимум 2000 символов").optional(),
    customerName: z.string().trim().max(120, "Максимум 120 символов").optional(),
    customerPhone: z
      .string()
      .trim()
      .max(32, "Максимум 32 символа")
      .refine((value) => value.length === 0 || /^[0-9()+\-\s]+$/u.test(value), "Телефон может содержать только цифры и символы +() -")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Передайте хотя бы одно поле для обновления",
  });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const routeParams = await params;
    const orderId = parseRouteInt(routeParams.id, "id");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        title: true,
        guitarSerial: true,
        description: true,
        customerName: true,
        customerPhone: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        laborSubtotalCents: true,
        partsSubtotalCents: true,
        invoiceTotalCents: true,
        works: {
          orderBy: { createdAt: "asc" },
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
            createdAt: true,
            updatedAt: true,
            performer: {
              select: {
                id: true,
                name: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        parts: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            orderId: true,
            name: true,
            unitPriceCents: true,
            quantity: true,
            costCents: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        comments: {
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
        },
        auditLogs: {
          take: 50,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            actorId: true,
            action: true,
            entity: true,
            entityId: true,
            orderId: true,
            diff: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return httpError(404, "Заказ не найден");
    }

    const { auditLogs, ...orderData } = order;

    return Response.json({
      ok: true,
      order: {
        ...orderData,
        audit: auditLogs,
      },
    });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const routeParams = await params;
    const orderId = parseRouteInt(routeParams.id, "id");

    const json = await req.json().catch(() => null);
    const parsed = updateOrderBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          title: true,
          guitarSerial: true,
          description: true,
          customerName: true,
          customerPhone: true,
        },
      });

      if (!existingOrder) {
        throw httpError(404, "Заказ не найден");
      }

      assertOrderMutable(existingOrder);

      const nextTitle = parsed.data.title ?? existingOrder.title;
      const nextGuitarSerial = parsed.data.guitarSerial !== undefined ? parsed.data.guitarSerial || null : existingOrder.guitarSerial;
      const nextDescription = parsed.data.description !== undefined ? parsed.data.description || null : existingOrder.description;
      const nextCustomerName = parsed.data.customerName !== undefined ? parsed.data.customerName || null : existingOrder.customerName;
      const nextCustomerPhone = parsed.data.customerPhone !== undefined ? parsed.data.customerPhone || null : existingOrder.customerPhone;

      const changed: Record<string, { from: unknown; to: unknown }> = {};

      if (nextTitle !== existingOrder.title) {
        changed.title = { from: existingOrder.title, to: nextTitle };
      }

      if (nextGuitarSerial !== existingOrder.guitarSerial) {
        changed.guitarSerial = { from: existingOrder.guitarSerial, to: nextGuitarSerial };
      }

      if (nextDescription !== existingOrder.description) {
        changed.description = { from: existingOrder.description, to: nextDescription };
      }

      if (nextCustomerName !== existingOrder.customerName) {
        changed.customerName = { from: existingOrder.customerName, to: nextCustomerName };
      }

      if (nextCustomerPhone !== existingOrder.customerPhone) {
        changed.customerPhone = { from: existingOrder.customerPhone, to: nextCustomerPhone };
      }

      if (Object.keys(changed).length === 0) {
        return existingOrder;
      }

      const updatedOrder = await tx.order.update({
        where: { id: existingOrder.id },
        data: {
          title: nextTitle,
          guitarSerial: nextGuitarSerial,
          description: nextDescription,
          customerName: nextCustomerName,
          customerPhone: nextCustomerPhone,
        },
        select: {
          id: true,
          status: true,
          title: true,
          guitarSerial: true,
          description: true,
          customerName: true,
          customerPhone: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.ORDER,
          entityId: existingOrder.id,
          orderId: existingOrder.id,
          diff: {
            changed,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedOrder;
    });

    return Response.json({ ok: true, order });
  } catch (e) {
    return toHttpError(e);
  }
}
