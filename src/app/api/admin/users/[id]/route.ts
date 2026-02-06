import { Prisma, AuditAction, AuditEntity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const { id } = params;

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
    const before: Record<string, boolean | number> = {};
    const after: Record<string, boolean | number> = {};

    if (data.isAdmin !== undefined && data.isAdmin !== existing.isAdmin) {
      before.isAdmin = existing.isAdmin;
      after.isAdmin = data.isAdmin;
    }

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      before.isActive = existing.isActive;
      after.isActive = data.isActive;
    }

    if (data.commissionPct !== undefined && data.commissionPct !== existing.commissionPct) {
      before.commissionPct = existing.commissionPct;
      after.commissionPct = data.commissionPct;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.USER,
      entityId: id,
      diff: {
        before,
        after,
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, user });
  } catch (e) {
    return toHttpError(e);
  }
}
