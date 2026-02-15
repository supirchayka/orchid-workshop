import { Prisma, AuditAction, AuditEntity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { parseRouteInt } from "@/lib/http/ids";
import { writeAudit } from "@/lib/audit/writeAudit";
import { updateUserBodySchema } from "@/lib/admin/users.schema";

const userSelect = {
  id: true,
  name: true,
  isAdmin: true,
  isActive: true,
  commissionPct: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;
    requireAdmin(session);

    const id = parseRouteInt(routeParams.id, "id");

    const json = await req.json().catch(() => null);
    const parsed = updateUserBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isAdmin: true,
        isActive: true,
        commissionPct: true,
      },
    });

    if (!existing) {
      return httpError(404, "Пользователь не найден");
    }

    const data = parsed.data;
    const nextIsAdmin = data.isAdmin ?? existing.isAdmin;
    const resolvedCommissionPct = nextIsAdmin ? 0 : (data.commissionPct ?? existing.commissionPct);
    const updateData: {
      isAdmin?: boolean;
      isActive?: boolean;
      commissionPct?: number;
    } = {};

    const isSelfUpdate = id === session.userId;
    if (isSelfUpdate && data.isActive === false) {
      return httpError(409, "Нельзя деактивировать самого себя");
    }

    if (isSelfUpdate && existing.isAdmin && data.isAdmin === false) {
      const activeAdminsCount = await prisma.user.count({
        where: {
          isAdmin: true,
          isActive: true,
        },
      });

      if (activeAdminsCount <= 1) {
        return httpError(409, "Нельзя снять права админа — вы единственный админ");
      }
    }

    const changed: Record<string, { from: boolean | number; to: boolean | number }> = {};

    if (data.isAdmin !== undefined && data.isAdmin !== existing.isAdmin) {
      changed.isAdmin = { from: existing.isAdmin, to: data.isAdmin };
      updateData.isAdmin = data.isAdmin;
    }

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      changed.isActive = { from: existing.isActive, to: data.isActive };
      updateData.isActive = data.isActive;
    }

    if (data.commissionPct !== undefined || data.isAdmin !== undefined) {
      updateData.commissionPct = resolvedCommissionPct;
    }

    if (
      (data.commissionPct !== undefined || data.isAdmin !== undefined) &&
      resolvedCommissionPct !== existing.commissionPct
    ) {
      changed.commissionPct = { from: existing.commissionPct, to: resolvedCommissionPct };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.USER,
      entityId: id,
      diff: {
        changed,
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, user });
  } catch (e) {
    return toHttpError(e);
  }
}
