import { requireSession } from "@/lib/auth/guards";
import { toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireSession();

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        commissionPct: true,
        isAdmin: true,
      },
      orderBy: { name: "asc" },
    });

    return Response.json({ ok: true, users });
  } catch (e) {
    return toHttpError(e);
  }
}
