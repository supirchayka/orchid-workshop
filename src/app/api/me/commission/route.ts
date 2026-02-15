import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = "day" | "week" | "month";

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Используйте формат YYYY-MM-DD")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), "Укажите корректную дату")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const querySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    bucket: z.enum(["day", "week", "month"]).default("month"),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(), {
    message: "Параметр from не может быть больше to",
    path: ["from"],
  });

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(startOfUtcDay(date).getTime() + DAY_MS - 1);
}

function getDefaultRange(now = new Date()): { from: Date; to: Date } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const to = tomorrow.getTime() < nextMonthStart.getTime() ? tomorrow : new Date(nextMonthStart.getTime() - DAY_MS);

  return { from: monthStart, to };
}

function getBucketStart(date: Date, bucket: Bucket): Date {
  if (bucket === "day") {
    return startOfUtcDay(date);
  }

  if (bucket === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  const dayStart = startOfUtcDay(date);
  const day = dayStart.getUTCDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  return new Date(dayStart.getTime() - offsetToMonday * DAY_MS);
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);

    const rawQuery = Object.fromEntries(searchParams.entries());

    if ("performerId" in rawQuery) {
      return httpError(400, "Параметр performerId недоступен");
    }

    const parsedQuery = querySchema.safeParse(rawQuery);

    if (!parsedQuery.success) {
      return httpError(400, "Неверные параметры запроса", { issues: parsedQuery.error.issues });
    }

    const defaultRange = getDefaultRange();
    const fromDate = parsedQuery.data.from ?? defaultRange.from;
    const toDate = parsedQuery.data.to ?? defaultRange.to;

    const from = startOfUtcDay(fromDate);
    const to = endOfUtcDay(toDate);

    if (session.isAdmin) {
      return Response.json({
        ok: true,
        range: {
          from: toYmd(from),
          to: toYmd(to),
          bucket: parsedQuery.data.bucket,
        },
        totals: {
          commissionCents: 0,
          laborCents: 0,
        },
        series: [],
        byOrder: [],
      });
    }

    const works = await prisma.orderWork.findMany({
      where: {
        performerId: session.userId,
        order: {
          status: OrderStatus.PAID,
          paidAt: {
            not: null,
            gte: from,
            lte: to,
          },
        },
      },
      orderBy: [{ order: { paidAt: "desc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        serviceName: true,
        unitPriceCents: true,
        quantity: true,
        commissionPctSnapshot: true,
        commissionCentsSnapshot: true,
        orderId: true,
        order: {
          select: {
            id: true,
            title: true,
            guitarSerial: true,
            paidAt: true,
          },
        },
      },
    });

    const byOrderMap = new Map<
      number,
      {
        order: { id: number; title: string; guitarSerial: string | null; paidAt: Date };
        laborCents: number;
        commissionCents: number;
        lines: Array<{
          id: number;
          serviceName: string;
          unitPriceCents: number;
          quantity: number;
          lineTotalCents: number;
          commissionPctSnapshot: number;
          commissionCentsSnapshot: number;
        }>;
      }
    >();

    const seriesMap = new Map<string, { bucketStart: string; laborCents: number; commissionCents: number }>();

    let totalLaborCents = 0;
    let totalCommissionCents = 0;

    for (const work of works) {
      if (!work.order.paidAt) {
        continue;
      }

      const lineTotalCents = work.unitPriceCents * work.quantity;
      totalLaborCents += lineTotalCents;
      totalCommissionCents += work.commissionCentsSnapshot;

      const byOrderItem = byOrderMap.get(work.orderId) ?? {
        order: {
          id: work.order.id,
          title: work.order.title,
          guitarSerial: work.order.guitarSerial,
          paidAt: work.order.paidAt,
        },
        laborCents: 0,
        commissionCents: 0,
        lines: [],
      };

      byOrderItem.laborCents += lineTotalCents;
      byOrderItem.commissionCents += work.commissionCentsSnapshot;
      byOrderItem.lines.push({
        id: work.id,
        serviceName: work.serviceName,
        unitPriceCents: work.unitPriceCents,
        quantity: work.quantity,
        lineTotalCents,
        commissionPctSnapshot: work.commissionPctSnapshot,
        commissionCentsSnapshot: work.commissionCentsSnapshot,
      });
      byOrderMap.set(work.orderId, byOrderItem);

      const bucketStart = getBucketStart(work.order.paidAt, parsedQuery.data.bucket).toISOString();
      const seriesItem = seriesMap.get(bucketStart) ?? {
        bucketStart,
        laborCents: 0,
        commissionCents: 0,
      };

      seriesItem.laborCents += lineTotalCents;
      seriesItem.commissionCents += work.commissionCentsSnapshot;
      seriesMap.set(bucketStart, seriesItem);
    }

    const byOrder = Array.from(byOrderMap.values());

    const series = Array.from(seriesMap.values()).sort((a, b) =>
      a.bucketStart.localeCompare(b.bucketStart),
    );

    return Response.json({
      ok: true,
      range: {
        from: toYmd(from),
        to: toYmd(to),
        bucket: parsedQuery.data.bucket,
      },
      totals: {
        commissionCents: totalCommissionCents,
        laborCents: totalLaborCents,
      },
      series,
      byOrder,
    });
  } catch (e) {
    return toHttpError(e);
  }
}
