import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { httpError, toHttpError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const dateOnlySchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Используйте формат YYYY-MM-DD");

const querySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    bucket: z.enum(["day", "week", "month"]).default("month"),
  })
  .refine((value) => {
    if (!value.from || !value.to) {
      return true;
    }

    return parseDateOnlyUtc(value.from).getTime() <= parseDateOnlyUtc(value.to).getTime();
  }, {
    message: "Параметр from не может быть больше to",
    path: ["from"],
  });

type BucketRow = {
  bucketStart: Date;
  cents: bigint | number | null;
};

type ByMasterRow = {
  performerId: string;
  performerName: string;
  laborCents: bigint | number | null;
  commissionCents: bigint | number | null;
};

type Bucket = "day" | "week" | "month";

function parseDateOnlyUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnlyUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfCurrentDayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_IN_DAY);
}

function addMonths(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function startOfBucketUtc(value: Date, bucket: Bucket): Date {
  if (bucket === "day") {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (bucket === "month") {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  const dayStart = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const dayOfWeek = dayStart.getUTCDay();
  const offsetToMonday = (dayOfWeek + 6) % 7;
  return addDays(dayStart, -offsetToMonday);
}

function addBucket(value: Date, bucket: Bucket): Date {
  if (bucket === "day") {
    return addDays(value, 1);
  }

  if (bucket === "week") {
    return addDays(value, 7);
  }

  return addMonths(value, 1);
}

function buildBucketTimeline(fromDate: Date, toDate: Date, bucket: Bucket): string[] {
  const start = startOfBucketUtc(fromDate, bucket);
  const end = startOfBucketUtc(toDate, bucket);
  const points: string[] = [];

  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    points.push(cursor.toISOString());
    cursor = addBucket(cursor, bucket);
  }

  return points;
}

function toCents(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requireAdmin(session);

    const { searchParams } = new URL(req.url);
    const parsedQuery = querySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      bucket: searchParams.get("bucket") ?? undefined,
    });

    if (!parsedQuery.success) {
      return httpError(400, "Неверные данные", { issues: parsedQuery.error.issues });
    }

    const defaultFrom = startOfCurrentMonthUtc();
    const defaultTo = startOfCurrentDayUtc();

    const fromDate = parsedQuery.data.from ? parseDateOnlyUtc(parsedQuery.data.from) : defaultFrom;
    const toDate = parsedQuery.data.to ? parseDateOnlyUtc(parsedQuery.data.to) : defaultTo;
    const toDateExclusive = addDays(toDate, 1);
    const bucket = parsedQuery.data.bucket;

    const [laborTotalRows, commissionTotalRows, expensesTotalRows, laborSeriesRows, commissionSeriesRows, expenseSeriesRows, byMasterRows] =
      await Promise.all([
        prisma.$queryRaw<{ cents: bigint | number | null }[]>(Prisma.sql`
          SELECT COALESCE(SUM(o."laborSubtotalCents"), 0)::bigint AS cents
          FROM "Order" o
          WHERE o."status" = 'PAID'::"OrderStatus"
            AND o."paidAt" >= ${fromDate}
            AND o."paidAt" < ${toDateExclusive}
        `),
        prisma.$queryRaw<{ cents: bigint | number | null }[]>(Prisma.sql`
          SELECT COALESCE(SUM(ow."commissionCentsSnapshot"), 0)::bigint AS cents
          FROM "OrderWork" ow
          INNER JOIN "Order" o ON o."id" = ow."orderId"
          WHERE o."status" = 'PAID'::"OrderStatus"
            AND o."paidAt" >= ${fromDate}
            AND o."paidAt" < ${toDateExclusive}
        `),
        prisma.$queryRaw<{ cents: bigint | number | null }[]>(Prisma.sql`
          SELECT COALESCE(SUM(e."amountCents"), 0)::bigint AS cents
          FROM "Expense" e
          WHERE e."expenseDate" >= ${fromDate}
            AND e."expenseDate" < ${toDateExclusive}
        `),
        prisma.$queryRaw<BucketRow[]>(Prisma.sql`
          SELECT
            date_trunc(${bucket}::text, o."paidAt") AS "bucketStart",
            COALESCE(SUM(o."laborSubtotalCents"), 0)::bigint AS cents
          FROM "Order" o
          WHERE o."status" = 'PAID'::"OrderStatus"
            AND o."paidAt" >= ${fromDate}
            AND o."paidAt" < ${toDateExclusive}
          GROUP BY 1
          ORDER BY 1
        `),
        prisma.$queryRaw<BucketRow[]>(Prisma.sql`
          SELECT
            date_trunc(${bucket}::text, o."paidAt") AS "bucketStart",
            COALESCE(SUM(ow."commissionCentsSnapshot"), 0)::bigint AS cents
          FROM "OrderWork" ow
          INNER JOIN "Order" o ON o."id" = ow."orderId"
          WHERE o."status" = 'PAID'::"OrderStatus"
            AND o."paidAt" >= ${fromDate}
            AND o."paidAt" < ${toDateExclusive}
          GROUP BY 1
          ORDER BY 1
        `),
        prisma.$queryRaw<BucketRow[]>(Prisma.sql`
          SELECT
            date_trunc(${bucket}::text, e."expenseDate") AS "bucketStart",
            COALESCE(SUM(e."amountCents"), 0)::bigint AS cents
          FROM "Expense" e
          WHERE e."expenseDate" >= ${fromDate}
            AND e."expenseDate" < ${toDateExclusive}
          GROUP BY 1
          ORDER BY 1
        `),
        prisma.$queryRaw<ByMasterRow[]>(Prisma.sql`
          SELECT
            ow."performerId",
            u."name" AS "performerName",
            COALESCE(SUM(ow."unitPriceCents" * ow."quantity"), 0)::bigint AS "laborCents",
            COALESCE(SUM(ow."commissionCentsSnapshot"), 0)::bigint AS "commissionCents"
          FROM "OrderWork" ow
          INNER JOIN "Order" o ON o."id" = ow."orderId"
          INNER JOIN "User" u ON u."id" = ow."performerId"
          WHERE o."status" = 'PAID'::"OrderStatus"
            AND o."paidAt" >= ${fromDate}
            AND o."paidAt" < ${toDateExclusive}
          GROUP BY ow."performerId", u."name"
          ORDER BY "commissionCents" DESC, "laborCents" DESC, u."name" ASC
        `),
      ]);

    const laborRevenuePaidCents = toCents(laborTotalRows[0]?.cents);
    const commissionsPaidCents = toCents(commissionTotalRows[0]?.cents);
    const expensesCents = toCents(expensesTotalRows[0]?.cents);
    const netProfitCents = laborRevenuePaidCents - commissionsPaidCents - expensesCents;

    const laborByBucket = new Map<string, number>();
    const commissionsByBucket = new Map<string, number>();
    const expensesByBucket = new Map<string, number>();

    for (const row of laborSeriesRows) {
      laborByBucket.set(new Date(row.bucketStart).toISOString(), toCents(row.cents));
    }

    for (const row of commissionSeriesRows) {
      commissionsByBucket.set(new Date(row.bucketStart).toISOString(), toCents(row.cents));
    }

    for (const row of expenseSeriesRows) {
      expensesByBucket.set(new Date(row.bucketStart).toISOString(), toCents(row.cents));
    }

    const bucketStarts = buildBucketTimeline(fromDate, toDate, bucket);

    const series = bucketStarts.map((bucketStart) => {
      const labor = laborByBucket.get(bucketStart) ?? 0;
      const commissions = commissionsByBucket.get(bucketStart) ?? 0;
      const expense = expensesByBucket.get(bucketStart) ?? 0;

      return {
        bucketStart,
        laborRevenuePaidCents: labor,
        commissionsPaidCents: commissions,
        expensesCents: expense,
        netProfitCents: labor - commissions - expense,
      };
    });

    const byMaster = byMasterRows.map((row) => ({
      performerId: row.performerId,
      name: row.performerName,
      laborCents: toCents(row.laborCents),
      commissionCents: toCents(row.commissionCents),
    }));

    return Response.json({
      ok: true,
      range: {
        from: formatDateOnlyUtc(fromDate),
        to: formatDateOnlyUtc(toDate),
        bucket,
      },
      totals: {
        laborRevenuePaidCents,
        commissionsPaidCents,
        expensesCents,
        netProfitCents,
      },
      series,
      byMaster,
    });
  } catch (e) {
    return toHttpError(e);
  }
}
