import { requireSession } from "@/lib/auth/guards";
import { toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireSession();

    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        defaultPriceCents: true,
      },
      orderBy: { name: "asc" },
    });

    return Response.json({ ok: true, services });
  } catch (e) {
    return toHttpError(e);
  }
}
