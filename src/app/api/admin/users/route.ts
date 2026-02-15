import { Prisma, AuditAction, AuditEntity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { writeAudit } from "@/lib/audit/writeAudit";
import { hashPassword } from "@/lib/auth/password";
import { createUserBodySchema } from "@/lib/admin/users.schema";

const userSelect = {
  id: true,
  name: true,
  isAdmin: true,
  isActive: true,
  commissionPct: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      ok: true,
      users: users.map((user) => ({
        ...user,
        commissionPct: user.isAdmin ? 0 : user.commissionPct,
      })),
    });
  } catch (e) {
    return toHttpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const json = await req.json().catch(() => null);
    const parsed = createUserBodySchema.safeParse(json);

    if (!parsed.success) {
      return httpError(400, "Неверные данные", { issues: parsed.error.issues });
    }

    const { name, password, isAdmin, commissionPct, isActive } = parsed.data;
    const normalizedCommissionPct = isAdmin ? 0 : commissionPct;

    const existing = await prisma.user.findUnique({ where: { name } });
    if (existing) {
      return httpError(409, "Пользователь с таким именем уже существует");
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        passwordHash,
        isAdmin,
        commissionPct: normalizedCommissionPct,
        isActive,
      },
      select: userSelect,
    });

    await writeAudit({
      actorId: session.userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.USER,
      entityId: user.id,
      diff: {
        created: {
          id: user.id,
          name: user.name,
          isAdmin: user.isAdmin,
          commissionPct: user.commissionPct,
          isActive: user.isActive,
        },
      } as Prisma.InputJsonValue,
    });

    return Response.json({ ok: true, user });
  } catch (e) {
    return toHttpError(e);
  }
}
