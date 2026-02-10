"use client";

import { OrderStatus } from "@prisma/client";
import * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { formatRub } from "@/lib/money";
import { OrderStatusBadgeVariant, OrderStatusLabel, orderStatusOptions } from "@/lib/orderStatus";

type ApiError = {
  ok?: false;
  message?: string;
};

type MeResponse = {
  ok: true;
  me: {
    id: string;
    name: string;
    isAdmin: boolean;
  };
};

type OrderDetailsResponse = {
  ok: true;
  order: {
    id: string;
    title: string;
    guitarSerial: string | null;
    description: string | null;
    status: OrderStatus;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
    laborSubtotalCents: number;
    partsSubtotalCents: number;
    invoiceTotalCents: number;
    orderExpensesCents: number;
    works: Array<{
      id: string;
      serviceName: string;
      unitPriceCents: number;
      quantity: number;
      performerId: string;
      commissionPctSnapshot: number;
      commissionCentsSnapshot: number;
      createdAt: string;
      performer: { id: string; name: string };
      service: { id: string; name: string } | null;
    }>;
    parts: Array<{
      id: string;
      name: string;
      unitPriceCents: number;
      quantity: number;
      costCents: number | null;
      createdAt: string;
    }>;
    expenses: Array<{
      id: string;
      title: string;
      amountCents: number;
      expenseDate: string;
      createdAt: string;
    }>;
    comments: Array<{
      id: string;
      text: string;
      createdAt: string;
      author: { id: string; name: string };
    }>;
    audit: Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string;
      actorId: string;
      createdAt: string;
      diff: unknown;
    }>;
  };
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  return data?.message ?? "Не удалось загрузить заказ";
}

export function OrderDetailsClient({ orderId }: { orderId: string }): React.JSX.Element {
  const [data, setData] = React.useState<OrderDetailsResponse["order"] | null>(null);
  const [me, setMe] = React.useState<MeResponse["me"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusSheetOpen, setStatusSheetOpen] = React.useState(false);
  const [nextStatus, setNextStatus] = React.useState<OrderStatus | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(false);

  const loadOrder = React.useCallback(async (): Promise<OrderDetailsResponse["order"]> => {
    const orderResponse = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    if (!orderResponse.ok) {
      throw new Error(await parseError(orderResponse));
    }

    const orderPayload = (await orderResponse.json()) as OrderDetailsResponse;
    return orderPayload.order;
  }, [orderId]);

  React.useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const [order, meResponse] = await Promise.all([loadOrder(), fetch("/api/me", { cache: "no-store" })]);

        if (!meResponse.ok) {
          if (!active) {
            return;
          }
          setError(await parseError(meResponse));
          return;
        }

        const mePayload = (await meResponse.json()) as MeResponse;

        if (!active) {
          return;
        }

        setData(order);
        setMe(mePayload.me);
      } catch {
        if (!active) {
          return;
        }
        setError("Ошибка сети. Попробуйте ещё раз");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadOrder]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">Загрузка заказа…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-400">{error}</p>
      </Card>
    );
  }

  if (!data || !me) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">Данные недоступны</p>
      </Card>
    );
  }

  const isLocked = data.status === OrderStatus.PAID;
  const cannotChangeStatus = isLocked && !me.isAdmin;

  const onChangeStatus = async (): Promise<void> => {
    if (!nextStatus || nextStatus === data.status) {
      return;
    }

    setStatusError(null);
    setStatusLoading(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setStatusError(await parseError(response));
        return;
      }

      const refreshedOrder = await loadOrder();
      setData(refreshedOrder);
      setStatusSheetOpen(false);
      setNextStatus(refreshedOrder.status);
    } catch {
      setStatusError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="p-4 sm:p-5">
        <CardHeader className="mb-3 flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{data.title}</CardTitle>
            {data.guitarSerial ? <p className="mt-1 text-sm text-[var(--muted)]">S/N: {data.guitarSerial}</p> : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={OrderStatusBadgeVariant[data.status]}>{OrderStatusLabel[data.status]}</Badge>

            <Sheet
              open={statusSheetOpen}
              onOpenChange={(open) => {
                setStatusSheetOpen(open);
                if (open) {
                  setNextStatus(data.status);
                  setStatusError(null);
                }
              }}
            >
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm" disabled={cannotChangeStatus} title={cannotChangeStatus ? "Только админ может менять статус оплаченного заказа" : undefined}>
                  Изменить статус
                </Button>
              </SheetTrigger>

              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Изменить статус</SheetTitle>
                </SheetHeader>

                <div className="space-y-2">
                  {orderStatusOptions.map((statusOption) => {
                    const disabledOption = cannotChangeStatus || (!me.isAdmin && statusOption.value === OrderStatus.PAID);

                    return (
                      <label
                        key={statusOption.value}
                        className="flex items-center justify-between rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-[var(--text)]">{statusOption.label}</p>
                          {!me.isAdmin && statusOption.value === OrderStatus.PAID ? (
                            <p className="text-xs text-[var(--muted-2)]">Только для админа</p>
                          ) : null}
                        </div>
                        <input
                          type="radio"
                          name="next-status"
                          checked={nextStatus === statusOption.value}
                          onChange={() => setNextStatus(statusOption.value)}
                          disabled={disabledOption}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </label>
                    );
                  })}
                </div>

                {statusError ? <ErrorText>{statusError}</ErrorText> : null}

                <SheetFooter>
                  <Button variant="ghost" onClick={() => setStatusSheetOpen(false)} disabled={statusLoading}>
                    Отмена
                  </Button>
                  <Button onClick={() => void onChangeStatus()} loading={statusLoading} disabled={!nextStatus || nextStatus === data.status}>
                    Сохранить
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>

        <CardContent className="space-y-1 text-sm">
          <p className="text-[var(--muted)]">Работы: {formatRub(data.laborSubtotalCents)}</p>
          <p className="text-[var(--muted)]">Запчасти: {formatRub(data.partsSubtotalCents)}</p>
          <p className="font-medium text-[var(--text)]">К оплате: {formatRub(data.invoiceTotalCents)}</p>
          {data.paidAt ? <p className="text-[var(--muted)]">Оплачен: {formatDateTime(data.paidAt)}</p> : null}
        </CardContent>
      </Card>

      {isLocked ? (
        <Card className="border-amber-400/40 bg-amber-500/10">
          <p className="text-sm font-medium text-amber-200">Заказ оплачен — изменения запрещены</p>
        </Card>
      ) : null}

      <Tabs defaultValue="works">
        <TabsList>
          <TabsTrigger value="works">Работы</TabsTrigger>
          <TabsTrigger value="parts">Запчасти</TabsTrigger>
          <TabsTrigger value="expenses">Расходы</TabsTrigger>
          <TabsTrigger value="comments">Комментарии</TabsTrigger>
          <TabsTrigger value="audit">Лог</TabsTrigger>
        </TabsList>

        <TabsContent value="works">
          <Card className="space-y-3">
            <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "только чтение"}</p>
            {data.works.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет работ</p>
            ) : (
              data.works.map((work) => {
                const canSeeCommission = me.isAdmin || work.performerId === me.id;
                const totalCents = work.unitPriceCents * work.quantity;

                return (
                  <div key={work.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text)]">{work.serviceName}</p>
                        <p className="text-xs text-[var(--muted)]">Исполнитель: {work.performer.name}</p>
                      </div>
                      <p className="text-xs text-[var(--muted-2)]">{formatDateTime(work.createdAt)}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted)] sm:grid-cols-4">
                      <p>Кол-во: {work.quantity}</p>
                      <p>Цена: {formatRub(work.unitPriceCents)}</p>
                      <p>Сумма: {formatRub(totalCents)}</p>
                      <p>Комиссия: {canSeeCommission ? formatRub(work.commissionCentsSnapshot) : "—"}</p>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </TabsContent>

        <TabsContent value="parts">
          <Card className="space-y-3">
            <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "только чтение"}</p>
            {data.parts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет запчастей</p>
            ) : (
              data.parts.map((part) => (
                <div key={part.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--text)]">{part.name}</p>
                    <p className="text-xs text-[var(--muted-2)]">{formatDateTime(part.createdAt)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
                    <p>Кол-во: {part.quantity}</p>
                    <p>Цена: {formatRub(part.unitPriceCents)}</p>
                    <p>Сумма: {formatRub(part.unitPriceCents * part.quantity)}</p>
                  </div>
                </div>
              ))
            )}
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card className="space-y-3">
            <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "только чтение"}</p>
            {data.expenses.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет расходов</p>
            ) : (
              data.expenses.map((expense) => (
                <div key={expense.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--text)]">{expense.title}</p>
                    <p className="text-xs text-[var(--muted-2)]">{formatDateTime(expense.expenseDate)}</p>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">Сумма: {formatRub(expense.amountCents)}</p>
                </div>
              ))
            )}
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card className="space-y-3">
            <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "только чтение"}</p>
            {data.comments.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет комментариев</p>
            ) : (
              data.comments.map((comment) => (
                <div key={comment.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--text)]">{comment.author.name}</p>
                    <p className="text-xs text-[var(--muted-2)]">{formatDateTime(comment.createdAt)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{comment.text}</p>
                </div>
              ))
            )}
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="space-y-3">
            <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "только чтение"}</p>
            {data.audit.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет записей лога</p>
            ) : (
              data.audit.map((entry) => (
                <div key={entry.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--text)]">
                      {entry.action} · {entry.entity}
                    </p>
                    <p className="text-xs text-[var(--muted-2)]">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <pre className="mt-2 overflow-x-auto text-xs text-[var(--muted)]">
                    {JSON.stringify(entry.diff ?? {}, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
