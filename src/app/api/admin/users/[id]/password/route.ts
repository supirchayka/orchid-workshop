import { Prisma, AuditAction, AuditEntity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { writeAudit } from "@/lib/audit/writeAudit";
import { hashPassword } from "@/lib/auth/password";
import { resetPasswordBodySchema } from "@/lib/admin/users.schema";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const routeParams = await params;
    requireAdmin(session);

    const { id } = routeParams;

    const json = await req.json().catch(() => null);
    const parsed = resetPasswordBodySchema.safeParse(json);
    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return httpError(404, "Пользователь не найден");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.USER,
      entityId: id,
      diff: { passwordReset: true } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true });
  } catch (e) {
    return toHttpError(e);
  }
}
