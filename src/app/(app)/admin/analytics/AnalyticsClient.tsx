"use client";

import * as React from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label } from "@/components/ui/Input";
import { formatDateRu } from "@/lib/dates";
import { formatRub } from "@/lib/money";

type Bucket = "day" | "week" | "month";

type AnalyticsSeriesItem = {
  bucketStart: string;
  laborRevenuePaidCents: number;
  commissionsPaidCents: number;
  expensesCents: number;
  netProfitCents: number;
};

type ByMasterItem = {
  performerId: number;
  name: string;
  laborCents: number;
  commissionCents: number;
};

type AnalyticsResponse = {
  ok: true;
  range: {
    from: string;
    to: string;
    bucket: Bucket;
  };
  totals: {
    laborRevenuePaidCents: number;
    commissionsPaidCents: number;
    expensesCents: number;
    netProfitCents: number;
  };
  series: AnalyticsSeriesItem[];
  byMaster: ByMasterItem[];
};

type ApiError = {
  ok?: false;
  message?: string;
};

type Filters = {
  from: string;
  to: string;
  bucket: Bucket;
};

function getDefaultPeriod(): Pick<Filters, "from" | "to"> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: monthStart.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function formatBucketLabel(value: string, bucket: Bucket): string {
  const date = new Date(value);

  if (bucket === "week") {
    return `Неделя с ${formatDateRu(date)}`;
  }

  return formatDateRu(date);
}

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  if (data?.message) {
    return data.message;
  }

  return "Не удалось выполнить запрос";
}

function maxAbs(values: number[]): number {
  const maxValue = values.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
  return maxValue || 1;
}

function buildRevenueExpenseChartData(series: AnalyticsSeriesItem[]): Array<{ key: string; label: string; labor: number; expenses: number }> {
  return series.map((item) => ({
    key: item.bucketStart,
    label: item.bucketStart,
    labor: item.laborRevenuePaidCents,
    expenses: item.expensesCents,
  }));
}

function buildNetProfitChartData(series: AnalyticsSeriesItem[]): Array<{ key: string; label: string; netProfit: number }> {
  return series.map((item) => ({
    key: item.bucketStart,
    label: item.bucketStart,
    netProfit: item.netProfitCents,
  }));
}

function MiniBarsChart({
  title,
  bucket,
  data,
  keys,
  formatter,
}: {
  title: string;
  bucket: Bucket;
  data: Array<Record<string, number | string>>;
  keys: Array<{ key: string; name: string; colorClass: string }>;
  formatter: (value: number) => string;
}): React.JSX.Element {
  const maxValue = maxAbs(
    data.flatMap((item) => keys.map(({ key }) => Number(item[key] ?? 0))),
  );

  return (
    <Card>
      <CardHeader className="mb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Нет данных за период.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid auto-cols-fr grid-flow-col gap-2 overflow-x-auto pb-1">
              {data.map((item) => (
                <div key={String(item.key)} className="min-w-16">
                  <div className="flex h-40 items-end gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--surface)]/70 p-2">
                    {keys.map(({ key, colorClass, name }) => {
                      const value = Number(item[key] ?? 0);
                      const barHeight = Math.max(3, Math.round((Math.abs(value) / maxValue) * 100));

                      return (
                        <div key={key} className="flex flex-1 flex-col items-center justify-end">
                          <div
                            className={`w-full rounded-md ${colorClass}`}
                            style={{ height: `${barHeight}%` }}
                            title={`${name}: ${formatter(value)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1 truncate text-center text-[11px] text-[var(--muted)]">{formatBucketLabel(String(item.label), bucket)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
              {keys.map(({ key, name, colorClass }) => (
                <div key={key} className="inline-flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsClient(): React.JSX.Element {
  const defaultPeriod = React.useMemo(() => getDefaultPeriod(), []);
  const [filters, setFilters] = React.useState<Filters>({
    from: defaultPeriod.from,
    to: defaultPeriod.to,
    bucket: "month",
  });

  const [appliedFilters, setAppliedFilters] = React.useState<Filters>({
    from: defaultPeriod.from,
    to: defaultPeriod.to,
    bucket: "month",
  });

  const [data, setData] = React.useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchAnalytics = React.useCallback(async (nextFilters: Filters) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (nextFilters.from) params.set("from", nextFilters.from);
      if (nextFilters.to) params.set("to", nextFilters.to);
      params.set("bucket", nextFilters.bucket);

      const response = await fetch(`/api/admin/analytics?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AnalyticsResponse;
      setData(payload);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchAnalytics(appliedFilters);
  }, [appliedFilters, fetchAnalytics]);

  const onShow = (): void => {
    setAppliedFilters(filters);
  };

  const hasAnyData = (data?.series.length ?? 0) > 0;
  const byMasterSorted = React.useMemo(
    () => (data?.byMaster ?? []).slice().sort((a, b) => b.commissionCents - a.commissionCents),
    [data?.byMaster],
  );

  return (
    <section className="space-y-4">
      <Card className="p-4 sm:p-5">
        <CardHeader className="mb-3">
          <CardTitle>Аналитика</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto] md:items-end">
            <div>
              <Label htmlFor="analytics-from">Период: от</Label>
              <Input
                id="analytics-from"
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="analytics-to">до</Label>
              <Input
                id="analytics-to"
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="analytics-bucket">Группировка</Label>
              <select
                id="analytics-bucket"
                className="h-11 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[15px] text-[var(--text)] outline-none transition focus:border-[var(--border-strong)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                value={filters.bucket}
                onChange={(event) => setFilters((prev) => ({ ...prev, bucket: event.target.value as Bucket }))}
              >
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
              </select>
            </div>
            <Button variant="secondary" size="md" loading={isLoading} onClick={onShow}>
              Показать
            </Button>
          </div>

          {error ? <ErrorText>{error}</ErrorText> : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs text-[var(--muted)]">Доход по работам</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatRub(data?.totals.laborRevenuePaidCents ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">Комиссии мастерам</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatRub(data?.totals.commissionsPaidCents ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">Расходы</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatRub(data?.totals.expensesCents ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">Чистая прибыль</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{formatRub(data?.totals.netProfitCents ?? 0)}</p>
        </Card>
      </div>

      {isLoading ? <Card><p className="text-sm text-[var(--muted)]">Загрузка аналитики…</p></Card> : null}

      {!isLoading && !error ? (
        <>
          {!hasAnyData ? <Card><p className="text-sm text-[var(--muted)]">Нет данных за период.</p></Card> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <MiniBarsChart
              title="Доход по работам и расходы"
              bucket={data?.range.bucket ?? filters.bucket}
              data={buildRevenueExpenseChartData(data?.series ?? [])}
              keys={[
                { key: "labor", name: "Доход по работам", colorClass: "bg-emerald-400/90" },
                { key: "expenses", name: "Расходы", colorClass: "bg-rose-400/90" },
              ]}
              formatter={(value) => formatRub(value)}
            />

            <MiniBarsChart
              title="Чистая прибыль"
              bucket={data?.range.bucket ?? filters.bucket}
              data={buildNetProfitChartData(data?.series ?? [])}
              keys={[{ key: "netProfit", name: "Чистая прибыль", colorClass: "bg-sky-400/90" }]}
              formatter={(value) => formatRub(value)}
            />
          </div>

          <Card>
            <CardHeader className="mb-3">
              <CardTitle className="text-base">По мастерам</CardTitle>
            </CardHeader>
            <CardContent>
              {byMasterSorted.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Нет данных за период.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                        <th className="pb-3 pr-4">Мастер</th>
                        <th className="pb-3 pr-4">Работы</th>
                        <th className="pb-3">Комиссия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMasterSorted.map((row) => (
                        <tr key={row.performerId} className="border-b border-white/5 text-[var(--text)] last:border-none">
                          <td className="py-3 pr-4">{row.name}</td>
                          <td className="py-3 pr-4">{formatRub(row.laborCents)}</td>
                          <td className="py-3 font-medium">{formatRub(row.commissionCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}

