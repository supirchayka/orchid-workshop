"use client";

import * as React from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label } from "@/components/ui/Input";
import { formatRub } from "@/lib/money";

type Bucket = "day" | "week" | "month";

type CommissionLine = {
  id: string;
  serviceName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  commissionPctSnapshot: number;
  commissionCentsSnapshot: number;
};

type CommissionByOrder = {
  order: {
    id: string;
    title: string;
    guitarSerial: string | null;
    paidAt: string;
  };
  laborCents: number;
  commissionCents: number;
  lines: CommissionLine[];
};

type CommissionSeriesItem = {
  bucketStart: string;
  commissionCents: number;
  laborCents: number;
};

type CommissionResponse = {
  ok: true;
  range: {
    from: string;
    to: string;
    bucket: Bucket;
  };
  totals: {
    commissionCents: number;
    laborCents: number;
  };
  series: CommissionSeriesItem[];
  byOrder: CommissionByOrder[];
};

type ApiError = {
  ok?: false;
  message?: string;
};

const bucketLabels: Record<Bucket, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBucketLabel(value: string, bucket: Bucket): string {
  const date = new Date(value);

  if (bucket === "month") {
    return date.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
  }

  if (bucket === "week") {
    const weekEnd = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000);
    return `${date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    })} — ${weekEnd.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    })}`;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return {
    from: monthStart.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  return data?.message ?? "Не удалось загрузить комиссию";
}

function MiniBarChart({
  data,
  bucket,
}: {
  data: CommissionSeriesItem[];
  bucket: Bucket;
}): React.JSX.Element {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Нет данных для графика.</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.commissionCents), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const width = Math.max(4, Math.round((item.commissionCents / maxValue) * 100));

        return (
          <div key={item.bucketStart} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span>{formatBucketLabel(item.bucketStart, bucket)}</span>
              <span className="text-[var(--text)]">{formatRub(item.commissionCents)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-[var(--accent)]"
                style={{ width: `${width}%` }}
                aria-label={`Комиссия ${formatRub(item.commissionCents)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CommissionClient(): React.JSX.Element {
  const defaultRange = React.useMemo(() => getCurrentMonthRange(), []);

  const [from, setFrom] = React.useState(defaultRange.from);
  const [to, setTo] = React.useState(defaultRange.to);
  const [bucket, setBucket] = React.useState<Bucket>("month");

  const [data, setData] = React.useState<CommissionResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadCommission = React.useCallback(
    async (next: { from: string; to: string; bucket: Bucket }) => {
      setError(null);

      const params = new URLSearchParams();
      params.set("from", next.from);
      params.set("to", next.to);
      params.set("bucket", next.bucket);

      const response = await fetch(`/api/me/commission?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const payload = (await response.json()) as CommissionResponse;
      setData(payload);
      setFrom(payload.range.from);
      setTo(payload.range.to);
      setBucket(payload.range.bucket);
    },
    [],
  );

  React.useEffect(() => {
    const run = async (): Promise<void> => {
      setIsLoading(true);
      try {
        await loadCommission({
          from: defaultRange.from,
          to: defaultRange.to,
          bucket: "month",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка сети. Попробуйте ещё раз");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [defaultRange.from, defaultRange.to, loadCommission]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!from || !to) {
      setError("Укажите период");
      return;
    }

    setIsSubmitting(true);
    try {
      await loadCommission({ from, to, bucket });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети. Попробуйте ещё раз");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmpty = !isLoading && !error && data && data.byOrder.length === 0;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Моя комиссия</h1>
        <p className="text-sm text-[var(--muted)]">Комиссия считается только по оплаченным заказам.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтр периода</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="commission-from">С</Label>
                <Input id="commission-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="commission-to">По</Label>
                <Input id="commission-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="commission-bucket">Группировка</Label>
                <select
                  id="commission-bucket"
                  value={bucket}
                  onChange={(event) => setBucket(event.target.value as Bucket)}
                  className="h-11 w-full rounded-[14px] border border-white/10 bg-[var(--surface)] px-3.5 text-[15px] text-[var(--text)] outline-none transition focus:border-[rgba(10,132,255,0.55)] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.18)]"
                >
                  <option value="day">День</option>
                  <option value="week">Неделя</option>
                  <option value="month">Месяц</option>
                </select>
              </div>
            </div>

            <Button type="submit" size="sm" loading={isSubmitting}>
              Показать
            </Button>
          </form>

          {error ? <ErrorText>{error}</ErrorText> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Комиссия</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data ? formatRub(data.totals.commissionCents) : "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сумма работ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data ? formatRub(data.totals.laborCents) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">График по {bucketLabels[data?.range.bucket ?? bucket].toLowerCase()}</CardTitle>
        </CardHeader>
        <CardContent>{isLoading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : <MiniBarChart data={data?.series ?? []} bucket={data?.range.bucket ?? bucket} />}</CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : null}

        {isEmpty ? <p className="ios-card p-4 text-sm text-[var(--muted)]">Нет оплаченных работ за период.</p> : null}

        {data?.byOrder.map((item) => (
          <Card key={item.order.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{item.order.title}</h2>
                <p className="text-sm text-[var(--muted)]">
                  {item.order.guitarSerial ? `Серийный номер: ${item.order.guitarSerial}` : "Без серийного номера"}
                </p>
                <p className="text-sm text-[var(--muted)]">Оплачен: {formatDateTime(item.order.paidAt)}</p>
              </div>

              <div className="text-right text-sm">
                <p>
                  Работы: <span className="font-medium">{formatRub(item.laborCents)}</span>
                </p>
                <p>
                  Комиссия: <span className="font-medium">{formatRub(item.commissionCents)}</span>
                </p>
              </div>
            </div>

            <details className="mt-3 rounded-[14px] border border-white/10 bg-[var(--surface)] p-3">
              <summary className="cursor-pointer text-sm font-medium">Строки работ ({item.lines.length})</summary>
              <div className="mt-3 space-y-2">
                {item.lines.map((line) => (
                  <div key={line.id} className="rounded-[12px] border border-white/10 bg-[var(--surface-2)] p-2 text-sm">
                    <p className="font-medium">{line.serviceName}</p>
                    <p className="text-[var(--muted)]">
                      {line.quantity} × {formatRub(line.unitPriceCents)} = {formatRub(line.lineTotalCents)}
                    </p>
                    <p className="text-[var(--muted)]">
                      Комиссия {line.commissionPctSnapshot}%: {formatRub(line.commissionCentsSnapshot)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </section>
  );
}
