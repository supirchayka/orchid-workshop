import { AuditAction, AuditEntity } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  entity: z.nativeEnum(AuditEntity).optional(),
  action: z.nativeEnum(AuditAction).optional(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession();

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      entity: url.searchParams.get("entity") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
    });

    if (!parsed.success) {
      return httpError(400, "Неверные параметры", { issues: parsed.error.issues });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!order) {
      return httpError(404, "Заказ не найден");
    }

    const audit = await prisma.auditLog.findMany({
      where: {
        orderId: order.id,
        ...(parsed.data.entity ? { entity: parsed.data.entity } : {}),
        ...(parsed.data.action ? { action: parsed.data.action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      select: {
        id: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        orderId: true,
        diff: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return Response.json({ ok: true, audit });
  } catch (e) {
    return toHttpError(e);
  }
}
