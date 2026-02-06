import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit/writeAudit";
import { createServiceBodySchema } from "@/lib/admin/services.schema";
import { httpError, toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

const serviceSelect = {
  id: true,
  name: true,
  defaultPriceCents: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const services = await prisma.service.findMany({
      select: serviceSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return Response.json({ ok: true, services });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const json = await req.json().catch(() => null);
    const parsed = createServiceBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const { name, defaultPriceCents, isActive } = parsed.data;

    const existing = await prisma.service.findUnique({ where: { name } });
    if (existing) {
      return httpError(409, "Услуга с таким названием уже существует");
    }

    const service = await prisma.service.create({
      data: {
        name,
        defaultPriceCents,
        isActive,
      },
      select: serviceSelect,
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.SERVICE,
      entityId: service.id,
      diff: {
        created: {
          id: service.id,
          name: service.name,
          defaultPriceCents: service.defaultPriceCents,
          isActive: service.isActive,
        },
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, service });
  } catch (e) {
    return toHttpError(e);
  }
}
