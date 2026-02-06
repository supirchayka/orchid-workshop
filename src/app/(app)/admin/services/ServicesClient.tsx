"use client";

import * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { formatRub, parseRubToCents } from "@/lib/money";

type Service = {
  id: string;
  name: string;
  defaultPriceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiError = {
  ok?: false;
  message?: string;
};

type ServiceForm = {
  name: string;
  priceRub: string;
  isActive: boolean;
};

const emptyCreateForm: ServiceForm = {
  name: "",
  priceRub: "",
  isActive: true,
};

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as ApiError | null;
  if (data?.message) {
    return data.message;
  }

  return "Не удалось выполнить запрос";
}

export function ServicesClient(): React.JSX.Element {
  const [services, setServices] = React.useState<Service[]>([]);
  const [search, setSearch] = React.useState("");
  const [isListLoading, setIsListLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<ServiceForm>(emptyCreateForm);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createLoading, setCreateLoading] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [editForm, setEditForm] = React.useState<ServiceForm>(emptyCreateForm);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);

  const fetchServices = React.useCallback(async () => {
    setIsListLoading(true);
    setListError(null);

    try {
      const response = await fetch("/api/admin/services", { cache: "no-store" });
      if (!response.ok) {
        setListError(await parseError(response));
        return;
      }

      const data = (await response.json()) as { ok: true; services: Service[] };
      setServices(data.services);
    } catch {
      setListError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setIsListLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const filteredServices = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return services;
    }

    return services.filter((service) => service.name.toLowerCase().includes(normalized));
  }, [services, search]);

  const onCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateError(null);

    let defaultPriceCents = 0;
    try {
      defaultPriceCents = parseRubToCents(createForm.priceRub);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Некорректная сумма");
      return;
    }

    setCreateLoading(true);

    try {
      const response = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          defaultPriceCents,
          isActive: createForm.isActive,
        }),
      });

      if (!response.ok) {
        setCreateError(await parseError(response));
        return;
      }

      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      await fetchServices();
    } catch {
      setCreateError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (service: Service): void => {
    setEditingService(service);
    setEditForm({
      name: service.name,
      priceRub: String(service.defaultPriceCents / 100).replace(".", ","),
      isActive: service.isActive,
    });
    setEditError(null);
    setEditOpen(true);
  };

  const onEdit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!editingService) {
      return;
    }

    setEditError(null);

    let defaultPriceCents = 0;
    try {
      defaultPriceCents = parseRubToCents(editForm.priceRub);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Некорректная сумма");
      return;
    }

    setEditLoading(true);

    try {
      const response = await fetch(`/api/admin/services/${editingService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          defaultPriceCents,
          isActive: editForm.isActive,
        }),
      });

      if (!response.ok) {
        setEditError(await parseError(response));
        return;
      }

      setEditOpen(false);
      setEditingService(null);
      await fetchServices();
    } catch {
      setEditError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="p-4 sm:p-5">
        <CardHeader className="mb-3 flex items-center justify-between gap-3">
          <div>
            <CardTitle>Услуги</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">Каталог работ мастерской</p>
          </div>
          <Button size="md" onClick={() => setCreateOpen(true)}>
            Добавить услугу
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="services-search">Поиск по названию</Label>
            <Input
              id="services-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Например: замена ладов"
            />
          </div>
          {listError ? <ErrorText>{listError}</ErrorText> : null}
        </CardContent>
      </Card>

      {isListLoading ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Загрузка услуг…</p>
        </Card>
      ) : null}

      {!isListLoading && filteredServices.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Услуги не найдены</p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {filteredServices.map((service) => (
          <Card key={service.id}>
            <CardHeader className="mb-3 flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{service.name}</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Цена по умолчанию: {formatRub(service.defaultPriceCents)}</p>
              </div>
              <Badge variant={service.isActive ? "success" : "danger"}>
                {service.isActive ? "Активна" : "Выключена"}
              </Badge>
            </CardHeader>
            <CardFooter className="mt-0">
              <Button size="md" variant="secondary" onClick={() => openEdit(service)}>
                Редактировать
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onCreate}>
            <SheetHeader>
              <SheetTitle>Новая услуга</SheetTitle>
              <SheetDescription>Укажите название, цену в рублях и статус</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="create-service-name">Название</Label>
              <Input
                id="create-service-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="create-service-price">Цена (рубли)</Label>
              <MoneyInput
                id="create-service-price"
                value={createForm.priceRub}
                onValueChange={(value) => setCreateForm((prev) => ({ ...prev, priceRub: value }))}
                onParseError={(message) => setCreateError(message)}
                placeholder="0,00"
                required
              />
            </div>

            <label className="flex h-11 items-center gap-3 rounded-[14px] border border-white/10 bg-[var(--surface)] px-3.5 text-sm">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4"
              />
              Активна
            </label>

            {createError ? <ErrorText>{createError}</ErrorText> : null}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={createLoading}>
                Отмена
              </Button>
              <Button type="submit" loading={createLoading}>
                Сохранить
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onEdit}>
            <SheetHeader>
              <SheetTitle>Редактировать услугу</SheetTitle>
              <SheetDescription>{editingService ? `Услуга: ${editingService.name}` : ""}</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="edit-service-name">Название</Label>
              <Input
                id="edit-service-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-service-price">Цена (рубли)</Label>
              <MoneyInput
                id="edit-service-price"
                value={editForm.priceRub}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, priceRub: value }))}
                onParseError={(message) => setEditError(message)}
                placeholder="0,00"
                required
              />
            </div>

            <label className="flex h-11 items-center gap-3 rounded-[14px] border border-white/10 bg-[var(--surface)] px-3.5 text-sm">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4"
              />
              Активна
            </label>

            {editError ? <ErrorText>{editError}</ErrorText> : null}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={editLoading}>
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
