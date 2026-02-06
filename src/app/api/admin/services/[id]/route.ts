import { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit/writeAudit";
import { updateServiceBodySchema } from "@/lib/admin/services.schema";
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

type ServiceChangedValue = string | number | boolean;
type ServiceDiff = Record<string, { from: ServiceChangedValue; to: ServiceChangedValue }>;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const { id } = params;

    const json = await req.json().catch(() => null);
    const parsed = updateServiceBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const existing = await prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        defaultPriceCents: true,
        isActive: true,
      },
    });

    if (!existing) {
      return httpError(404, "Услуга не найдена");
    }

    const data = parsed.data;

    if (data.name !== undefined && data.name !== existing.name) {
      const duplicate = await prisma.service.findUnique({ where: { name: data.name } });
      if (duplicate) {
        return httpError(409, "Услуга с таким названием уже существует");
      }
    }

    const changed: ServiceDiff = {};

    if (data.name !== undefined && data.name !== existing.name) {
      changed.name = { from: existing.name, to: data.name };
    }

    if (
      data.defaultPriceCents !== undefined &&
      data.defaultPriceCents !== existing.defaultPriceCents
    ) {
      changed.defaultPriceCents = {
        from: existing.defaultPriceCents,
        to: data.defaultPriceCents,
      };
    }

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      changed.isActive = { from: existing.isActive, to: data.isActive };
    }

    const service = await prisma.service.update({
      where: { id },
      data,
      select: serviceSelect,
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.SERVICE,
      entityId: service.id,
      diff: {
        changed,
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, service });
  } catch (e) {
    return toHttpError(e);
  }
}
