import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const routeParams = await params;

    const order = await prisma.order.findUnique({
      where: { id: routeParams.id },
      select: {
        id: true,
        title: true,
        guitarSerial: true,
        description: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        laborSubtotalCents: true,
        partsSubtotalCents: true,
        invoiceTotalCents: true,
        orderExpensesCents: true,
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
        expenses: {
          orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            orderId: true,
            title: true,
            amountCents: true,
            expenseDate: true,
            createdById: true,
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
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
