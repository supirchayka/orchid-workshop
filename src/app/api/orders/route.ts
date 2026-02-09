import { AuditAction, AuditEntity, OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit/writeAudit";
import { httpError, toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

const orderStatusSchema = z.nativeEnum(OrderStatus);

const createOrderBodySchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(80, "Максимум 80 символов"),
  guitarSerial: z.string().trim().max(80, "Максимум 80 символов").optional(),
  description: z.string().trim().max(2000, "Максимум 2000 символов").optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.trim() ?? "";
    const statusParams = searchParams.getAll("status");
    const mine = searchParams.get("mine") === "1";

    const parsedStatuses = z.array(orderStatusSchema).safeParse(statusParams);
    if (!parsedStatuses.success) {
      return httpError(400, "Неверный фильтр статуса", { issues: parsedStatuses.error.issues });
    }

    const where: Prisma.OrderWhereInput = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { guitarSerial: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(parsedStatuses.data.length > 0 ? { status: { in: parsedStatuses.data } } : {}),
      ...(mine ? { works: { some: { performerId: session.userId } } } : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        guitarSerial: true,
        status: true,
        paidAt: true,
        updatedAt: true,
        laborSubtotalCents: true,
        partsSubtotalCents: true,
        invoiceTotalCents: true,
        comments: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            text: true,
            createdAt: true,
            author: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return Response.json({
      ok: true,
      orders: orders.map((order) => ({
        id: order.id,
        title: order.title,
        guitarSerial: order.guitarSerial,
        status: order.status,
        paidAt: order.paidAt,
        updatedAt: order.updatedAt,
        laborSubtotalCents: order.laborSubtotalCents,
        partsSubtotalCents: order.partsSubtotalCents,
        invoiceTotalCents: order.invoiceTotalCents,
        lastComment: order.comments[0]
          ? {
              text: order.comments[0].text,
              authorName: order.comments[0].author.name,
              createdAt: order.comments[0].createdAt,
            }
          : null,
      })),
    });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();

    const json = await req.json().catch(() => null);
    const parsed = createOrderBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const title = parsed.data.title;
    const guitarSerial = parsed.data.guitarSerial || null;
    const description = parsed.data.description || null;

    const order = await prisma.order.create({
      data: {
        title,
        guitarSerial,
        description,
        status: OrderStatus.NEW,
        createdById: session.userId,
      },
      select: {
        id: true,
        title: true,
        guitarSerial: true,
        description: true,
        status: true,
      },
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.ORDER,
      entityId: order.id,
      orderId: order.id,
      diff: {
        created: {
          id: order.id,
          title: order.title,
          guitarSerial: order.guitarSerial,
          description: order.description,
          status: OrderStatus.NEW,
        },
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, order: { id: order.id } });
  } catch (e) {
    return toHttpError(e);
  }
}
