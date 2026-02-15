import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME, authCookieOptions } from "@/lib/http/cookies";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AuditAction, AuditEntity } from "@prisma/client";

const Body = z.object({
  name: z.string().min(1, "Введите имя"),
  password: z.string().min(1, "Введите пароль"),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Неверные данные", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { name } });
  if (!user || !user.isActive) {
    return NextResponse.json({ ok: false, message: "Неверный логин или пароль" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Неверный логин или пароль" }, { status: 401 });
  }

  const token = await signToken({ sub: String(user.id), name: user.name, isAdmin: user.isAdmin });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());

  await writeAudit({
    actorId: user.id,
    action: AuditAction.LOGIN,
    entity: AuditEntity.AUTH,
    entityId: user.id,
    diff: { name: user.name },
  });

  return res;
}
