"use client";

import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label, TextArea } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { apiGet, apiPost } from "@/lib/http/api";
import { formatRub } from "@/lib/money";
import { orderStatusOptions } from "@/lib/orderStatus";

type OrderListItem = {
  id: number;
  title: string;
  guitarSerial: string | null;
  description: string | null;
  customerName: string | null;
  customerPhone: string | null;
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
  const { showToast } = useToast();

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<OrderStatus[]>([]);
  const [mineOnly, setMineOnly] = React.useState(false);
  const [orders, setOrders] = React.useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
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

      const data = await apiGet<{ ok: true; orders: OrderListItem[] }>(`/api/orders?${params.toString()}`);
      setOrders(data.orders);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка запроса");
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
      const data = await apiPost<{ ok: true; order: { id: number } }>("/api/orders", {
        title: cleanTitle,
        customerName,
        customerPhone,
        guitarSerial,
        description,
      });

      setCreateOpen(false);
      setTitle("");
      setCustomerName("");
      setCustomerPhone("");
      setGuitarSerial("");
      setDescription("");
      showToast("Добавлено");
      router.push(`/orders/${data.order.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Ошибка запроса");
      showToast(error instanceof Error ? error.message : "Ошибка запроса", "error");
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
                <Label htmlFor="create-order-customer-name">Заказчик</Label>
                <Input
                  id="create-order-customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Имя клиента"
                  maxLength={120}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-order-customer-phone">Телефон</Label>
                <Input
                  id="create-order-customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="+7 900 123-45-67"
                  maxLength={32}
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

      <Card className="p-4 sm:p-5 transition-none hover:translate-y-0 hover:shadow-[var(--panel-shadow)]">
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
              placeholder="Поиск по названию, клиенту, телефону, описанию или серийному номеру"
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
                        className="flex cursor-pointer items-center justify-between rounded-[14px] bg-white/[0.06] px-3 py-2"
                      >
                        <Badge variant={status.badgeVariant}>{status.label}</Badge>
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {orders.map((order) => {
          const comment = order.lastComment
            ? `${order.lastComment.authorName}: ${order.lastComment.text.replace(/\s+/gu, " ").trim()}`
            : null;
          const normalizedDescription = order.description?.replace(/\s+/gu, " ").trim() ?? "";
          const descriptionPreview =
            normalizedDescription.length > 140 ? `${normalizedDescription.slice(0, 140)}…` : normalizedDescription;

          return (
            <Link key={order.id} href={`/orders/${order.id}`} className="block">
              <Card className="bg-white/[0.015]">
                <CardHeader className="mb-2 flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="mt-1 flex min-h-8 items-center gap-2 text-base leading-tight">
                      <span className="truncate">{order.title}</span>
                      <span className="shrink-0 text-sm font-medium text-[var(--muted-2)]/90">
                        #{order.id}
                      </span>
                    </CardTitle>
                    {order.guitarSerial ? (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">S/N: {order.guitarSerial}</p>
                    ) : null}
                    {order.customerName ? (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">Заказчик: {order.customerName}</p>
                    ) : null}
                    {order.customerPhone ? (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">Телефон: {order.customerPhone}</p>
                    ) : null}
                    {descriptionPreview ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">{descriptionPreview}</p>
                    ) : null}
                  </div>
                  <OrderStatusBadge status={order.status} />
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
