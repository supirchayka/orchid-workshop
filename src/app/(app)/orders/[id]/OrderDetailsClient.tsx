"use client";

import { OrderStatus } from "@prisma/client";
import * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label } from "@/components/ui/Input";
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

type StaffService = {
  id: string;
  name: string;
  defaultPriceCents: number;
};

type StaffUser = {
  id: string;
  name: string;
  commissionPct: number;
  isAdmin: boolean;
};

type ServicesResponse = { ok: true; services: StaffService[] };
type UsersResponse = { ok: true; users: StaffUser[] };

type WorkItem = {
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
    works: WorkItem[];
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

type WorkMode = "from-service" | "custom";

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function centsToRubInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function rubInputToCents(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const rub = Number(normalized);
  if (!Number.isFinite(rub) || rub < 0) return null;

  return Math.round(rub * 100);
}

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  return data?.message ?? "Не удалось выполнить операцию";
}

const selectClassName =
  "h-11 w-full rounded-[14px] border border-white/10 bg-[var(--surface)] px-3.5 text-[15px] text-[var(--text)] outline-none transition focus:border-[rgba(10,132,255,0.55)] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.18)]";

export function OrderDetailsClient({ orderId }: { orderId: string }): React.JSX.Element {
  const [data, setData] = React.useState<OrderDetailsResponse["order"] | null>(null);
  const [me, setMe] = React.useState<MeResponse["me"] | null>(null);
  const [services, setServices] = React.useState<StaffService[]>([]);
  const [users, setUsers] = React.useState<StaffUser[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [statusSheetOpen, setStatusSheetOpen] = React.useState(false);
  const [nextStatus, setNextStatus] = React.useState<OrderStatus | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(false);

  const [createSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<WorkMode>("from-service");
  const [createServiceId, setCreateServiceId] = React.useState("");
  const [createServiceName, setCreateServiceName] = React.useState("");
  const [createPerformerId, setCreatePerformerId] = React.useState("");
  const [createUnitPriceRub, setCreateUnitPriceRub] = React.useState("");
  const [createQuantity, setCreateQuantity] = React.useState("1");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createLoading, setCreateLoading] = React.useState(false);

  const [editSheetOpen, setEditSheetOpen] = React.useState(false);
  const [editingWork, setEditingWork] = React.useState<WorkItem | null>(null);
  const [editServiceName, setEditServiceName] = React.useState("");
  const [editPerformerId, setEditPerformerId] = React.useState("");
  const [editUnitPriceRub, setEditUnitPriceRub] = React.useState("");
  const [editQuantity, setEditQuantity] = React.useState("1");
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);

  const [deleteWorkId, setDeleteWorkId] = React.useState<string | null>(null);

  const loadOrder = React.useCallback(async (): Promise<OrderDetailsResponse["order"]> => {
    const orderResponse = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    if (!orderResponse.ok) {
      throw new Error(await parseError(orderResponse));
    }

    const orderPayload = (await orderResponse.json()) as OrderDetailsResponse;
    return orderPayload.order;
  }, [orderId]);

  const refreshOrder = React.useCallback(async () => {
    const refreshedOrder = await loadOrder();
    setData(refreshedOrder);
    return refreshedOrder;
  }, [loadOrder]);

  React.useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const [order, meResponse, servicesResponse, usersResponse] = await Promise.all([
          loadOrder(),
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/services", { cache: "no-store" }),
          fetch("/api/users", { cache: "no-store" }),
        ]);

        if (!meResponse.ok || !servicesResponse.ok || !usersResponse.ok) {
          if (!active) return;

          const failed = !meResponse.ok ? meResponse : !servicesResponse.ok ? servicesResponse : usersResponse;
          setError(await parseError(failed));
          return;
        }

        const mePayload = (await meResponse.json()) as MeResponse;
        const servicesPayload = (await servicesResponse.json()) as ServicesResponse;
        const usersPayload = (await usersResponse.json()) as UsersResponse;

        if (!active) return;

        setData(order);
        setMe(mePayload.me);
        setServices(servicesPayload.services);
        setUsers(usersPayload.users);
      } catch {
        if (!active) return;
        setError("Ошибка сети. Попробуйте ещё раз");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadOrder]);

  const resetCreateForm = React.useCallback(() => {
    setCreateMode("from-service");
    setCreateServiceId(services[0]?.id ?? "");
    setCreateServiceName("");
    setCreatePerformerId(users[0]?.id ?? "");
    setCreateUnitPriceRub(services[0] ? centsToRubInput(services[0].defaultPriceCents) : "");
    setCreateQuantity("1");
    setCreateError(null);
  }, [services, users]);

  React.useEffect(() => {
    if (createSheetOpen) {
      resetCreateForm();
    }
  }, [createSheetOpen, resetCreateForm]);

  React.useEffect(() => {
    if (createMode === "from-service" && createServiceId) {
      const selectedService = services.find((item) => item.id === createServiceId);
      if (selectedService) {
        setCreateUnitPriceRub(centsToRubInput(selectedService.defaultPriceCents));
      }
    }
  }, [createMode, createServiceId, services]);

  const onChangeStatus = async (): Promise<void> => {
    if (!nextStatus || !data || nextStatus === data.status) return;

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

      const refreshedOrder = await refreshOrder();
      setStatusSheetOpen(false);
      setNextStatus(refreshedOrder.status);
    } catch {
      setStatusError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setStatusLoading(false);
    }
  };

  const onCreateWork = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!data) return;

    const unitPriceCents = rubInputToCents(createUnitPriceRub);
    const quantity = Number(createQuantity);

    if (unitPriceCents === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setCreateError("Проверьте цену и количество");
      return;
    }

    if (!createPerformerId) {
      setCreateError("Выберите исполнителя");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const endpoint = createMode === "from-service" ? "from-service" : "custom";
      const body =
        createMode === "from-service"
          ? {
              serviceId: createServiceId,
              performerId: createPerformerId,
              unitPriceCents,
              quantity,
            }
          : {
              serviceName: createServiceName.trim(),
              performerId: createPerformerId,
              unitPriceCents,
              quantity,
            };

      if (createMode === "from-service" && !createServiceId) {
        setCreateError("Выберите услугу");
        return;
      }

      if (createMode === "custom" && !createServiceName.trim()) {
        setCreateError("Укажите название работы");
        return;
      }

      const response = await fetch(`/api/orders/${data.id}/works/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setCreateError(await parseError(response));
        return;
      }

      await refreshOrder();
      setCreateSheetOpen(false);
    } catch {
      setCreateError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditSheet = (work: WorkItem): void => {
    setEditingWork(work);
    setEditServiceName(work.serviceName);
    setEditPerformerId(work.performerId);
    setEditUnitPriceRub(centsToRubInput(work.unitPriceCents));
    setEditQuantity(String(work.quantity));
    setEditError(null);
    setEditSheetOpen(true);
  };

  const onEditWork = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!data || !editingWork) return;

    const unitPriceCents = rubInputToCents(editUnitPriceRub);
    const quantity = Number(editQuantity);

    if (unitPriceCents === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setEditError("Проверьте цену и количество");
      return;
    }

    if (!editPerformerId) {
      setEditError("Выберите исполнителя");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const payload: Record<string, unknown> = {
        unitPriceCents,
        quantity,
        performerId: editPerformerId,
      };

      if (editingWork.service === null) {
        payload.serviceName = editServiceName.trim();
        if (!String(payload.serviceName)) {
          setEditError("Укажите название работы");
          return;
        }
      }

      const response = await fetch(`/api/orders/${data.id}/works/${editingWork.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setEditError(await parseError(response));
        return;
      }

      await refreshOrder();
      setEditSheetOpen(false);
      setEditingWork(null);
    } catch {
      setEditError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setEditLoading(false);
    }
  };

  const onDeleteWork = async (workId: string): Promise<void> => {
    if (!data) return;
    if (!window.confirm("Удалить работу из заказа?")) return;

    setDeleteWorkId(workId);

    try {
      const response = await fetch(`/api/orders/${data.id}/works/${workId}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      await refreshOrder();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setDeleteWorkId(null);
    }
  };

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
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cannotChangeStatus}
                  title={cannotChangeStatus ? "Только админ может менять статус оплаченного заказа" : undefined}
                >
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "редактирование"}</p>
              <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" disabled={isLocked}>
                    Добавить работу
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
                  <form className="space-y-3" onSubmit={onCreateWork}>
                    <SheetHeader>
                      <SheetTitle>Добавить работу</SheetTitle>
                    </SheetHeader>

                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant={createMode === "from-service" ? "primary" : "secondary"} onClick={() => setCreateMode("from-service")}>
                        Из каталога
                      </Button>
                      <Button type="button" variant={createMode === "custom" ? "primary" : "secondary"} onClick={() => setCreateMode("custom")}>
                        Кастомная
                      </Button>
                    </div>

                    {createMode === "from-service" ? (
                      <div>
                        <Label htmlFor="create-service">Услуга</Label>
                        <select id="create-service" className={selectClassName} value={createServiceId} onChange={(event) => setCreateServiceId(event.target.value)} required>
                          {services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="create-service-name">Название работы</Label>
                        <Input id="create-service-name" value={createServiceName} onChange={(event) => setCreateServiceName(event.target.value)} maxLength={80} required />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="create-performer">Исполнитель</Label>
                      <select id="create-performer" className={selectClassName} value={createPerformerId} onChange={(event) => setCreatePerformerId(event.target.value)} required>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} {user.isAdmin ? "(админ)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="create-unit-price">Цена (руб)</Label>
                      <Input id="create-unit-price" type="number" min={0} step="0.01" value={createUnitPriceRub} onChange={(event) => setCreateUnitPriceRub(event.target.value)} required />
                    </div>

                    <div>
                      <Label htmlFor="create-qty">Количество</Label>
                      <Input id="create-qty" type="number" min={1} max={999} step={1} value={createQuantity} onChange={(event) => setCreateQuantity(event.target.value)} required />
                    </div>

                    {createError ? <ErrorText>{createError}</ErrorText> : null}

                    <SheetFooter>
                      <Button type="button" variant="ghost" onClick={() => setCreateSheetOpen(false)} disabled={createLoading}>
                        Отмена
                      </Button>
                      <Button type="submit" loading={createLoading}>
                        Добавить
                      </Button>
                    </SheetFooter>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

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
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-xs text-[var(--muted-2)]">{formatDateTime(work.createdAt)}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditSheet(work)} disabled={isLocked}>
                            Изменить
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => void onDeleteWork(work.id)} disabled={isLocked || deleteWorkId === work.id} loading={deleteWorkId === work.id}>
                            Удалить
                          </Button>
                        </div>
                      </div>
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
                  <pre className="mt-2 overflow-x-auto text-xs text-[var(--muted)]">{JSON.stringify(entry.diff ?? {}, null, 2)}</pre>
                </div>
              ))
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) {
            setEditingWork(null);
            setEditError(null);
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onEditWork}>
            <SheetHeader>
              <SheetTitle>Редактировать работу</SheetTitle>
            </SheetHeader>

            {editingWork?.service === null ? (
              <div>
                <Label htmlFor="edit-service-name">Название работы</Label>
                <Input id="edit-service-name" value={editServiceName} onChange={(event) => setEditServiceName(event.target.value)} maxLength={80} required />
              </div>
            ) : null}

            <div>
              <Label htmlFor="edit-performer">Исполнитель</Label>
              <select id="edit-performer" className={selectClassName} value={editPerformerId} onChange={(event) => setEditPerformerId(event.target.value)} required>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.isAdmin ? "(админ)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="edit-unit-price">Цена (руб)</Label>
              <Input id="edit-unit-price" type="number" min={0} step="0.01" value={editUnitPriceRub} onChange={(event) => setEditUnitPriceRub(event.target.value)} required />
            </div>

            <div>
              <Label htmlFor="edit-qty">Количество</Label>
              <Input id="edit-qty" type="number" min={1} max={999} step={1} value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} required />
            </div>

            {editError ? <ErrorText>{editError}</ErrorText> : null}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setEditSheetOpen(false)} disabled={editLoading}>
                Отмена
              </Button>
              <Button type="submit" loading={editLoading}>
                Сохранить
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
