"use client";

import { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label, TextArea } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { formatRub } from "@/lib/money";
import { orderStatusMeta, orderStatusOptions } from "@/lib/orderStatus";

type OrderListItem = {
  id: string;
  title: string;
  guitarSerial: string | null;
  status: OrderStatus;
  paidAt: string | null;
  updatedAt: string;
  laborSubtotalCents: number;
  partsSubtotalCents: number;
  invoiceTotalCents: number;
  lastComment: {
    text: string;
    authorName: string;
    createdAt: string;
  } | null;
};

type ApiError = {
  ok?: false;
  message?: string;
};

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  return data?.message ?? "Не удалось загрузить заказы";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrdersClient(): React.JSX.Element {
  const router = useRouter();

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<OrderStatus[]>([]);
  const [mineOnly, setMineOnly] = React.useState(false);
  const [orders, setOrders] = React.useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [guitarSerial, setGuitarSerial] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const hasFilters = search.trim().length > 0 || statuses.length > 0 || mineOnly;

  const loadOrders = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const trimmed = search.trim();
      if (trimmed) {
        params.set("q", trimmed);
      }

      statuses.forEach((status) => params.append("status", status));

      if (mineOnly) {
        params.set("mine", "1");
      }

      const response = await fetch(`/api/orders?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const data = (await response.json()) as { ok: true; orders: OrderListItem[] };
      setOrders(data.orders);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setIsLoading(false);
    }
  }, [mineOnly, search, statuses]);

  React.useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const toggleStatus = (status: OrderStatus): void => {
    setStatuses((prev) => (prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]));
  };

  const onCreateOrder = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setCreateError("Введите название заказа");
      return;
    }

    setCreateError(null);
    setCreateLoading(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          guitarSerial,
          description,
        }),
      });

      if (!response.ok) {
        setCreateError(await parseError(response));
        return;
      }

      const data = (await response.json()) as { ok: true; order: { id: string } };

      setCreateOpen(false);
      setTitle("");
      setGuitarSerial("");
      setDescription("");
      router.push(`/orders/${data.order.id}`);
    } catch {
      setCreateError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button size="sm">Новый заказ</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Новый заказ</SheetTitle>
            </SheetHeader>

            <form className="space-y-3" onSubmit={(event) => void onCreateOrder(event)}>
              <div className="space-y-1">
                <Label htmlFor="create-order-title">Название</Label>
                <Input
                  id="create-order-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например: Fender Stratocaster"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-order-serial">Серийный номер</Label>
                <Input
                  id="create-order-serial"
                  value={guitarSerial}
                  onChange={(event) => setGuitarSerial(event.target.value)}
                  placeholder="Опционально"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-order-description">Описание</Label>
                <TextArea
                  id="create-order-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Опционально"
                  rows={5}
                />
              </div>

              {createError ? <ErrorText>{createError}</ErrorText> : null}

              <Button type="submit" className="w-full" loading={createLoading}>
                Создать заказ
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="p-4 sm:p-5">
        <CardHeader className="mb-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="orders-search">Поиск</Label>
            <Input
              id="orders-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию или серийному номеру"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm">
                  Статусы {statuses.length > 0 ? `(${statuses.length})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Фильтр по статусам</SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {orderStatusOptions.map((status) => {
                    const active = statuses.includes(status.value);

                    return (
                      <label
                        key={status.value}
                        className="flex cursor-pointer items-center justify-between rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2"
                      >
                        <span className="text-sm text-[var(--text)]">{status.label}</span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleStatus(status.value)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </label>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant={mineOnly ? "primary" : "secondary"}
              size="sm"
              onClick={() => setMineOnly((prev) => !prev)}
            >
              Мои работы
            </Button>

            <Button variant="ghost" size="sm" onClick={() => void loadOrders()}>
              Обновить
            </Button>
          </div>

          {error ? <ErrorText>{error}</ErrorText> : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Загрузка заказов…</p>
        </Card>
      ) : null}

      {!isLoading && orders.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">{hasFilters ? "Ничего не найдено" : "Нет заказов"}</p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {orders.map((order) => {
          const status = orderStatusMeta[order.status];
          const comment = order.lastComment
            ? `${order.lastComment.authorName}: ${order.lastComment.text.replace(/\s+/gu, " ").trim()}`
            : null;

          return (
            <Link key={order.id} href={`/orders/${order.id}`} className="block">
              <Card className="transition hover:border-white/20 hover:bg-white/[0.04]">
                <CardHeader className="mb-2 flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{order.title}</CardTitle>
                    {order.guitarSerial ? (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">S/N: {order.guitarSerial}</p>
                    ) : null}
                  </div>
                  <Badge variant={status.badgeVariant}>{status.label}</Badge>
                </CardHeader>

                <CardContent className="space-y-1 text-sm">
                  <p className="text-[var(--muted)]">Работы: {formatRub(order.laborSubtotalCents)}</p>
                  <p className="text-[var(--muted)]">Запчасти: {formatRub(order.partsSubtotalCents)}</p>
                  <p className="font-medium text-[var(--text)]">К оплате: {formatRub(order.invoiceTotalCents)}</p>

                  {comment ? <p className="truncate text-xs text-[var(--muted)]">{comment}</p> : null}
                  <p className="text-xs text-[var(--muted-2)]">Обновлён: {formatDate(order.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
