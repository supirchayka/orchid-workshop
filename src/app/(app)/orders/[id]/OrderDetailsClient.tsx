"use client";

import { AuditAction, AuditEntity, OrderStatus } from "@prisma/client";
import * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label, TextArea } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { formatDateTimeRu } from "@/lib/dates";
import { formatRub, parseRubToCents } from "@/lib/money";
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

type PartItem = {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  costCents: number | null;
  createdAt: string;
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
    parts: PartItem[];
    expenses: Array<{
      id: string;
      title: string;
      amountCents: number;
      expenseDate: string;
      createdById: string;
      createdBy: { id: string; name: string };
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

type AuditChanged = Record<string, { from: unknown; to: unknown }>;

type AuditDiff = {
  created?: Record<string, unknown>;
  changed?: AuditChanged;
  deleted?: Record<string, unknown>;
};

type AuditEntry = {
  id: string;
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  orderId: string | null;
  diff: unknown;
  createdAt: string;
  actor: {
    id: string;
    name: string;
  };
};

type AuditListResponse = {
  ok: true;
  audit: AuditEntry[];
};

type AuditEntityFilter = "ALL" | AuditEntity;
type AuditActionFilter = "ALL" | AuditAction;

const auditEntityLabel: Record<AuditEntity, string> = {
  ORDER: "заказ",
  ORDER_WORK: "работу",
  ORDER_PART: "запчасть",
  EXPENSE: "расход",
  COMMENT: "комментарий",
  USER: "пользователя",
  SERVICE: "услугу",
  AUTH: "авторизацию",
};

const auditActionLabel: Record<AuditAction, string> = {
  CREATE: "создал",
  UPDATE: "изменил",
  DELETE: "удалил",
  STATUS_CHANGE: "сменил статус",
  LOGIN: "выполнил вход",
  LOGOUT: "выполнил выход",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  return formatDateTimeRu(value);
}

function centsToRubInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function asAuditDiff(value: unknown): AuditDiff | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as AuditDiff;
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  return JSON.stringify(value);
}

function getCreatedDetails(diff: AuditDiff): Array<{ key: string; value: string }> {
  if (!diff.created) return [];

  return Object.entries(diff.created)
    .filter(([key]) => key !== "updatedAt" && key !== "createdAt")
    .map(([key, value]) => ({ key, value: formatAuditValue(value) }));
}

function getChangedDetails(diff: AuditDiff): Array<{ key: string; from: string; to: string }> {
  if (!diff.changed) return [];

  return Object.entries(diff.changed).map(([key, value]) => ({
    key,
    from: formatAuditValue(value.from),
    to: formatAuditValue(value.to),
  }));
}

function getDeletedDetails(diff: AuditDiff): string {
  if (!diff.deleted) return "—";

  if (typeof diff.deleted.id === "string") {
    return diff.deleted.id;
  }

  return formatAuditValue(diff.deleted.id);
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

  const [createPartSheetOpen, setCreatePartSheetOpen] = React.useState(false);
  const [createPartName, setCreatePartName] = React.useState("");
  const [createPartUnitPriceRub, setCreatePartUnitPriceRub] = React.useState("");
  const [createPartQuantity, setCreatePartQuantity] = React.useState("1");
  const [createPartError, setCreatePartError] = React.useState<string | null>(null);
  const [createPartLoading, setCreatePartLoading] = React.useState(false);

  const [editPartSheetOpen, setEditPartSheetOpen] = React.useState(false);
  const [editingPart, setEditingPart] = React.useState<PartItem | null>(null);
  const [editPartName, setEditPartName] = React.useState("");
  const [editPartUnitPriceRub, setEditPartUnitPriceRub] = React.useState("");
  const [editPartQuantity, setEditPartQuantity] = React.useState("1");
  const [editPartError, setEditPartError] = React.useState<string | null>(null);
  const [editPartLoading, setEditPartLoading] = React.useState(false);

  const [deletePartId, setDeletePartId] = React.useState<string | null>(null);
  const [createExpenseSheetOpen, setCreateExpenseSheetOpen] = React.useState(false);
  const [createExpenseTitle, setCreateExpenseTitle] = React.useState("");
  const [createExpenseAmountRub, setCreateExpenseAmountRub] = React.useState("");
  const [createExpenseDate, setCreateExpenseDate] = React.useState("");
  const [createExpenseError, setCreateExpenseError] = React.useState<string | null>(null);
  const [createExpenseLoading, setCreateExpenseLoading] = React.useState(false);

  const [editExpenseSheetOpen, setEditExpenseSheetOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<OrderDetailsResponse["order"]["expenses"][number] | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = React.useState("");
  const [editExpenseAmountRub, setEditExpenseAmountRub] = React.useState("");
  const [editExpenseDate, setEditExpenseDate] = React.useState("");
  const [editExpenseError, setEditExpenseError] = React.useState<string | null>(null);
  const [editExpenseLoading, setEditExpenseLoading] = React.useState(false);

  const [deleteExpenseId, setDeleteExpenseId] = React.useState<string | null>(null);
  const [newCommentText, setNewCommentText] = React.useState("");
  const [createCommentError, setCreateCommentError] = React.useState<string | null>(null);
  const [createCommentLoading, setCreateCommentLoading] = React.useState(false);
  const [audit, setAudit] = React.useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditError, setAuditError] = React.useState<string | null>(null);
  const [auditEntityFilter, setAuditEntityFilter] = React.useState<AuditEntityFilter>("ALL");
  const [auditActionFilter, setAuditActionFilter] = React.useState<AuditActionFilter>("ALL");

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

  const loadAudit = React.useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const params = new URLSearchParams({ limit: "200" });

      if (auditEntityFilter !== "ALL") {
        params.set("entity", auditEntityFilter);
      }

      if (auditActionFilter !== "ALL") {
        params.set("action", auditActionFilter);
      }

      const response = await fetch(`/api/orders/${orderId}/audit?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setAuditError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuditListResponse;
      setAudit(payload.audit);
    } catch {
      setAuditError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setAuditLoading(false);
    }
  }, [auditActionFilter, auditEntityFilter, orderId]);

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

  React.useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

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

    const quantity = Number(createQuantity);
    let unitPriceCents: number;

    try {
      unitPriceCents = parseRubToCents(createUnitPriceRub);
    } catch {
      setCreateError("Проверьте цену и количество");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
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

    const quantity = Number(editQuantity);
    let unitPriceCents: number;

    try {
      unitPriceCents = parseRubToCents(editUnitPriceRub);
    } catch {
      setEditError("Проверьте цену и количество");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
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


  const resetCreatePartForm = React.useCallback(() => {
    setCreatePartName("");
    setCreatePartUnitPriceRub("");
    setCreatePartQuantity("1");
    setCreatePartError(null);
  }, []);

  React.useEffect(() => {
    if (createPartSheetOpen) {
      resetCreatePartForm();
    }
  }, [createPartSheetOpen, resetCreatePartForm]);

  const openEditPartSheet = (part: PartItem): void => {
    setEditingPart(part);
    setEditPartName(part.name);
    setEditPartUnitPriceRub(centsToRubInput(part.unitPriceCents));
    setEditPartQuantity(String(part.quantity));
    setEditPartError(null);
    setEditPartSheetOpen(true);
  };

  const onCreatePart = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!data) return;

    const name = createPartName.trim();
    const quantity = Number(createPartQuantity);

    let unitPriceCents: number;

    try {
      unitPriceCents = parseRubToCents(createPartUnitPriceRub);
    } catch {
      setCreatePartError("Проверьте цену в рублях");
      return;
    }

    if (!name || name.length > 120) {
      setCreatePartError("Укажите название запчасти (до 120 символов)");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setCreatePartError("Количество должно быть от 1 до 999");
      return;
    }

    setCreatePartLoading(true);
    setCreatePartError(null);

    try {
      const response = await fetch(`/api/orders/${data.id}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unitPriceCents, quantity }),
      });

      if (!response.ok) {
        setCreatePartError(await parseError(response));
        return;
      }

      await refreshOrder();
      setCreatePartSheetOpen(false);
    } catch {
      setCreatePartError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setCreatePartLoading(false);
    }
  };

  const onEditPart = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!data || !editingPart) return;

    const name = editPartName.trim();
    const quantity = Number(editPartQuantity);

    let unitPriceCents: number;

    try {
      unitPriceCents = parseRubToCents(editPartUnitPriceRub);
    } catch {
      setEditPartError("Проверьте цену в рублях");
      return;
    }

    if (!name || name.length > 120) {
      setEditPartError("Укажите название запчасти (до 120 символов)");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setEditPartError("Количество должно быть от 1 до 999");
      return;
    }

    setEditPartLoading(true);
    setEditPartError(null);

    try {
      const response = await fetch(`/api/orders/${data.id}/parts/${editingPart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unitPriceCents, quantity }),
      });

      if (!response.ok) {
        setEditPartError(await parseError(response));
        return;
      }

      await refreshOrder();
      setEditPartSheetOpen(false);
      setEditingPart(null);
    } catch {
      setEditPartError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setEditPartLoading(false);
    }
  };

  const onDeletePart = async (partId: string): Promise<void> => {
    if (!data) return;
    if (!window.confirm("Удалить запчасть из заказа?")) return;

    setDeletePartId(partId);

    try {
      const response = await fetch(`/api/orders/${data.id}/parts/${partId}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      await refreshOrder();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setDeletePartId(null);
    }
  };

  const resetCreateExpenseForm = React.useCallback(() => {
    setCreateExpenseTitle("");
    setCreateExpenseAmountRub("");
    setCreateExpenseDate("");
    setCreateExpenseError(null);
  }, []);

  React.useEffect(() => {
    if (createExpenseSheetOpen) {
      resetCreateExpenseForm();
    }
  }, [createExpenseSheetOpen, resetCreateExpenseForm]);

  const canManageExpense = React.useCallback(
    (expense: OrderDetailsResponse["order"]["expenses"][number]) => me.isAdmin || expense.createdById === me.id,
    [me.id, me.isAdmin],
  );

  const onCreateExpense = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!data) return;

    let amountCents: number;

    try {
      amountCents = parseRubToCents(createExpenseAmountRub);
    } catch {
      setCreateExpenseError("Проверьте сумму");
      return;
    }

    if (!createExpenseTitle.trim()) {
      setCreateExpenseError("Укажите название расхода");
      return;
    }

    setCreateExpenseLoading(true);
    setCreateExpenseError(null);

    try {
      const response = await fetch(`/api/orders/${data.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createExpenseTitle.trim(),
          amountCents,
          ...(createExpenseDate ? { expenseDate: createExpenseDate } : {}),
        }),
      });

      if (!response.ok) {
        setCreateExpenseError(await parseError(response));
        return;
      }

      await refreshOrder();
      setCreateExpenseSheetOpen(false);
    } catch {
      setCreateExpenseError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setCreateExpenseLoading(false);
    }
  };

  const openEditExpenseSheet = (expense: OrderDetailsResponse["order"]["expenses"][number]): void => {
    setEditingExpense(expense);
    setEditExpenseTitle(expense.title);
    setEditExpenseAmountRub(centsToRubInput(expense.amountCents));
    setEditExpenseDate(expense.expenseDate.slice(0, 10));
    setEditExpenseError(null);
    setEditExpenseSheetOpen(true);
  };

  const onEditExpense = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!data || !editingExpense) return;

    let amountCents: number;

    try {
      amountCents = parseRubToCents(editExpenseAmountRub);
    } catch {
      setEditExpenseError("Проверьте сумму");
      return;
    }

    if (!editExpenseTitle.trim()) {
      setEditExpenseError("Укажите название расхода");
      return;
    }

    setEditExpenseLoading(true);
    setEditExpenseError(null);

    try {
      const response = await fetch(`/api/orders/${data.id}/expenses/${editingExpense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editExpenseTitle.trim(),
          amountCents,
          expenseDate: editExpenseDate,
        }),
      });

      if (!response.ok) {
        setEditExpenseError(await parseError(response));
        return;
      }

      await refreshOrder();
      setEditExpenseSheetOpen(false);
      setEditingExpense(null);
    } catch {
      setEditExpenseError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setEditExpenseLoading(false);
    }
  };

  const onDeleteExpense = async (expense: OrderDetailsResponse["order"]["expenses"][number]): Promise<void> => {
    if (!data) return;
    if (!window.confirm("Удалить расход?")) return;

    setDeleteExpenseId(expense.id);

    try {
      const response = await fetch(`/api/orders/${data.id}/expenses/${expense.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      await refreshOrder();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setDeleteExpenseId(null);
    }
  };

  const onCreateComment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!data) return;

    const text = newCommentText.trim();

    if (!text) {
      setCreateCommentError("Введите комментарий");
      return;
    }

    setCreateCommentLoading(true);
    setCreateCommentError(null);

    try {
      const response = await fetch(`/api/orders/${data.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        setCreateCommentError(await parseError(response));
        return;
      }

      setNewCommentText("");
      await refreshOrder();
    } catch {
      setCreateCommentError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setCreateCommentLoading(false);
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

            <div className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
              <p className="text-[var(--muted)]">Итого по работам: {formatRub(data.laborSubtotalCents)}</p>
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "редактирование"}</p>
              <Sheet open={createPartSheetOpen} onOpenChange={setCreatePartSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" disabled={isLocked}>
                    Добавить запчасть
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
                  <form className="space-y-3" onSubmit={onCreatePart}>
                    <SheetHeader>
                      <SheetTitle>Добавить запчасть</SheetTitle>
                    </SheetHeader>

                    <div>
                      <Label htmlFor="create-part-name">Название</Label>
                      <Input id="create-part-name" value={createPartName} onChange={(event) => setCreatePartName(event.target.value)} maxLength={120} required />
                    </div>

                    <div>
                      <Label htmlFor="create-part-unit-price">Цена (руб)</Label>
                      <Input
                        id="create-part-unit-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={createPartUnitPriceRub}
                        onChange={(event) => setCreatePartUnitPriceRub(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="create-part-qty">Количество</Label>
                      <Input
                        id="create-part-qty"
                        type="number"
                        min={1}
                        max={999}
                        step={1}
                        value={createPartQuantity}
                        onChange={(event) => setCreatePartQuantity(event.target.value)}
                        required
                      />
                    </div>

                    {createPartError ? <ErrorText>{createPartError}</ErrorText> : null}

                    <SheetFooter>
                      <Button type="button" variant="ghost" onClick={() => setCreatePartSheetOpen(false)} disabled={createPartLoading}>
                        Отмена
                      </Button>
                      <Button type="submit" loading={createPartLoading}>
                        Добавить
                      </Button>
                    </SheetFooter>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

            <div className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
              <p className="text-[var(--muted)]">Итого запчасти: {formatRub(data.partsSubtotalCents)}</p>
            </div>

            {data.parts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет запчастей</p>
            ) : (
              data.parts.map((part) => (
                <div key={part.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text)]">{part.name}</p>
                      <p className="text-xs text-[var(--muted-2)]">{formatDateTime(part.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEditPartSheet(part)} disabled={isLocked}>
                        Изменить
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void onDeletePart(part.id)}
                        disabled={isLocked || deletePartId === part.id}
                        loading={deletePartId === part.id}
                      >
                        Удалить
                      </Button>
                    </div>
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted-2)]">Режим: {isLocked ? "только чтение (оплачено)" : "редактирование"}</p>
              <Sheet open={createExpenseSheetOpen} onOpenChange={setCreateExpenseSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" disabled={isLocked}>
                    Добавить расход
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
                  <form className="space-y-3" onSubmit={onCreateExpense}>
                    <SheetHeader>
                      <SheetTitle>Добавить расход</SheetTitle>
                    </SheetHeader>

                    <div>
                      <Label htmlFor="create-expense-title">Название</Label>
                      <Input id="create-expense-title" value={createExpenseTitle} onChange={(event) => setCreateExpenseTitle(event.target.value)} maxLength={160} required />
                    </div>

                    <div>
                      <Label htmlFor="create-expense-amount">Сумма (руб)</Label>
                      <Input
                        id="create-expense-amount"
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={createExpenseAmountRub}
                        onChange={(event) => setCreateExpenseAmountRub(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="create-expense-date">Дата расхода</Label>
                      <Input id="create-expense-date" type="date" value={createExpenseDate} onChange={(event) => setCreateExpenseDate(event.target.value)} />
                    </div>

                    {createExpenseError ? <ErrorText>{createExpenseError}</ErrorText> : null}

                    <SheetFooter>
                      <Button type="button" variant="ghost" onClick={() => setCreateExpenseSheetOpen(false)} disabled={createExpenseLoading}>
                        Отмена
                      </Button>
                      <Button type="submit" loading={createExpenseLoading}>
                        Добавить
                      </Button>
                    </SheetFooter>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

            <div className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
              <p className="text-[var(--muted)]">Итого расходов по заказу: {formatRub(data.orderExpensesCents)}</p>
            </div>

            {data.expenses.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Нет расходов</p>
            ) : (
              data.expenses.map((expense) => {
                const canManage = canManageExpense(expense);

                return (
                  <div key={expense.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text)]">{expense.title}</p>
                        <p className="text-xs text-[var(--muted)]">Добавил: {expense.createdBy.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted-2)]">{formatDateTime(expense.expenseDate)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEditExpenseSheet(expense)} disabled={isLocked || !canManage}>
                          Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void onDeleteExpense(expense)}
                          disabled={isLocked || !canManage || deleteExpenseId === expense.id}
                          loading={deleteExpenseId === expense.id}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">Сумма: {formatRub(expense.amountCents)}</p>
                  </div>
                );
              })
            )}
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card className="space-y-3">
            <form className="space-y-2 rounded-[14px] border border-white/10 bg-[var(--surface)] p-3" onSubmit={onCreateComment}>
              <Label htmlFor="new-comment">Комментарий</Label>
              <TextArea
                id="new-comment"
                placeholder="Напишите комментарий по заказу"
                value={newCommentText}
                onChange={(event) => setNewCommentText(event.target.value)}
                maxLength={2000}
                disabled={isLocked || createCommentLoading}
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--muted-2)]">{isLocked ? "Оплаченный заказ: добавление отключено" : "Новые комментарии сверху"}</p>
                <Button type="submit" size="sm" disabled={isLocked} loading={createCommentLoading}>
                  Добавить
                </Button>
              </div>

              {createCommentError ? <ErrorText>{createCommentError}</ErrorText> : null}
            </form>

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
            <div className="rounded-[14px] border border-white/10 bg-[var(--surface)] p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-44 flex-1">
                  <Label htmlFor="audit-entity">Сущность</Label>
                  <select
                    id="audit-entity"
                    className={selectClassName}
                    value={auditEntityFilter}
                    onChange={(event) => setAuditEntityFilter(event.target.value as AuditEntityFilter)}
                  >
                    <option value="ALL">Все</option>
                    <option value={AuditEntity.ORDER}>ORDER</option>
                    <option value={AuditEntity.ORDER_WORK}>ORDER_WORK</option>
                    <option value={AuditEntity.ORDER_PART}>ORDER_PART</option>
                    <option value={AuditEntity.EXPENSE}>EXPENSE</option>
                    <option value={AuditEntity.COMMENT}>COMMENT</option>
                    <option value={AuditEntity.USER}>USER</option>
                    <option value={AuditEntity.SERVICE}>SERVICE</option>
                    <option value={AuditEntity.AUTH}>AUTH</option>
                  </select>
                </div>

                <div className="min-w-44 flex-1">
                  <Label htmlFor="audit-action">Действие</Label>
                  <select
                    id="audit-action"
                    className={selectClassName}
                    value={auditActionFilter}
                    onChange={(event) => setAuditActionFilter(event.target.value as AuditActionFilter)}
                  >
                    <option value="ALL">Все</option>
                    <option value={AuditAction.CREATE}>CREATE</option>
                    <option value={AuditAction.UPDATE}>UPDATE</option>
                    <option value={AuditAction.DELETE}>DELETE</option>
                    <option value={AuditAction.STATUS_CHANGE}>STATUS_CHANGE</option>
                    <option value={AuditAction.LOGIN}>LOGIN</option>
                    <option value={AuditAction.LOGOUT}>LOGOUT</option>
                  </select>
                </div>

                <Button type="button" variant="secondary" onClick={() => void loadAudit()} loading={auditLoading}>
                  Обновить
                </Button>
              </div>

              {auditError ? <ErrorText className="mt-2">{auditError}</ErrorText> : null}
            </div>

            {auditLoading && audit.length === 0 ? <p className="text-sm text-[var(--muted)]">Загрузка лога…</p> : null}

            {!auditLoading && audit.length === 0 ? <p className="text-sm text-[var(--muted)]">Нет записей лога</p> : null}

            {audit.map((entry) => {
              const diff = asAuditDiff(entry.diff);
              const createdDetails = diff ? getCreatedDetails(diff) : [];
              const changedDetails = diff ? getChangedDetails(diff) : [];
              const deletedId = diff ? getDeletedDetails(diff) : "—";

              return (
                <div key={entry.id} className="rounded-[14px] border border-white/10 bg-[var(--surface)] px-3 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-[var(--text)]">
                      {entry.actor.name} — {auditActionLabel[entry.action]} {auditEntityLabel[entry.entity]}
                    </p>
                    <p className="text-xs text-[var(--muted-2)]">{formatDateTime(entry.createdAt)}</p>
                  </div>

                  <details className="mt-2 rounded-[12px] border border-white/10 bg-black/10 px-3 py-2">
                    <summary className="cursor-pointer text-xs text-[var(--muted)]">Детали</summary>

                    <div className="mt-2 space-y-2 text-xs text-[var(--muted)]">
                      {createdDetails.length > 0 ? (
                        <div>
                          <p className="mb-1 font-medium text-[var(--text)]">Создано</p>
                          <ul className="space-y-1">
                            {createdDetails.map((item) => (
                              <li key={item.key}>
                                {item.key}: {item.value}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {changedDetails.length > 0 ? (
                        <div>
                          <p className="mb-1 font-medium text-[var(--text)]">Изменения</p>
                          <ul className="space-y-1">
                            {changedDetails.map((item) => (
                              <li key={item.key}>
                                {item.key}: {item.from} → {item.to}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {diff?.deleted ? (
                        <div>
                          <p className="font-medium text-[var(--text)]">Удалено</p>
                          <p>id: {deletedId}</p>
                        </div>
                      ) : null}

                      {!diff || (createdDetails.length === 0 && changedDetails.length === 0 && !diff.deleted) ? (
                        <p>Нет подробностей</p>
                      ) : null}
                    </div>
                  </details>
                </div>
              );
            })}
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

      <Sheet
        open={editExpenseSheetOpen}
        onOpenChange={(open) => {
          setEditExpenseSheetOpen(open);
          if (!open) {
            setEditingExpense(null);
            setEditExpenseError(null);
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onEditExpense}>
            <SheetHeader>
              <SheetTitle>Редактировать расход</SheetTitle>
            </SheetHeader>

            <div>
              <Label htmlFor="edit-expense-title">Название</Label>
              <Input id="edit-expense-title" value={editExpenseTitle} onChange={(event) => setEditExpenseTitle(event.target.value)} maxLength={160} required />
            </div>

            <div>
              <Label htmlFor="edit-expense-amount">Сумма (руб)</Label>
              <Input
                id="edit-expense-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={editExpenseAmountRub}
                onChange={(event) => setEditExpenseAmountRub(event.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-expense-date">Дата расхода</Label>
              <Input id="edit-expense-date" type="date" value={editExpenseDate} onChange={(event) => setEditExpenseDate(event.target.value)} required />
            </div>

            {editExpenseError ? <ErrorText>{editExpenseError}</ErrorText> : null}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setEditExpenseSheetOpen(false)} disabled={editExpenseLoading}>
                Отмена
              </Button>
              <Button type="submit" loading={editExpenseLoading}>
                Сохранить
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={editPartSheetOpen}
        onOpenChange={(open) => {
          setEditPartSheetOpen(open);
          if (!open) {
            setEditingPart(null);
            setEditPartError(null);
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onEditPart}>
            <SheetHeader>
              <SheetTitle>Редактировать запчасть</SheetTitle>
            </SheetHeader>

            <div>
              <Label htmlFor="edit-part-name">Название</Label>
              <Input id="edit-part-name" value={editPartName} onChange={(event) => setEditPartName(event.target.value)} maxLength={120} required />
            </div>

            <div>
              <Label htmlFor="edit-part-unit-price">Цена (руб)</Label>
              <Input
                id="edit-part-unit-price"
                type="number"
                min={0}
                step="0.01"
                value={editPartUnitPriceRub}
                onChange={(event) => setEditPartUnitPriceRub(event.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-part-qty">Количество</Label>
              <Input
                id="edit-part-qty"
                type="number"
                min={1}
                max={999}
                step={1}
                value={editPartQuantity}
                onChange={(event) => setEditPartQuantity(event.target.value)}
                required
              />
            </div>

            {editPartError ? <ErrorText>{editPartError}</ErrorText> : null}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setEditPartSheetOpen(false)} disabled={editPartLoading}>
                Отмена
              </Button>
              <Button type="submit" loading={editPartLoading}>
                Сохранить
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
