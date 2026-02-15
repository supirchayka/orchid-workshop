"use client";

import * as React from "react";

import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, Input, Label } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/http/api";
import { formatRub, parseRubToCents } from "@/lib/money";

type Expense = {
  id: number;
  title: string;
  amountCents: number;
  expenseDate: string;
  createdBy: {
    name: string;
  };
};

type ExpenseForm = {
  title: string;
  amountRub: string;
  expenseDate: string;
};

const emptyExpenseForm: ExpenseForm = {
  title: "",
  amountRub: "",
  expenseDate: "",
};

function toDateInputValue(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

export function AdminExpensesClient(): React.JSX.Element {
  const { showToast } = useToast();
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [isListLoading, setIsListLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [filterFrom, setFilterFrom] = React.useState("");
  const [filterTo, setFilterTo] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<ExpenseForm>(emptyExpenseForm);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createLoading, setCreateLoading] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null);
  const [editForm, setEditForm] = React.useState<ExpenseForm>(emptyExpenseForm);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);

  const [deleteId, setDeleteId] = React.useState<number | null>(null);

  const fetchExpenses = React.useCallback(async (params?: { from?: string; to?: string }) => {
    setIsListLoading(true);
    setListError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params?.from) searchParams.set("from", params.from);
      if (params?.to) searchParams.set("to", params.to);
      const query = searchParams.toString();

      const payload = await apiGet<{ ok: true; expenses: Expense[] }>(`/api/admin/expenses${query ? `?${query}` : ""}`);
      setExpenses(payload.expenses);
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setIsListLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  const onApplyPeriod = async (): Promise<void> => {
    await fetchExpenses({
      from: filterFrom || undefined,
      to: filterTo || undefined,
    });
  };

  const onCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateError(null);

    let amountCents = 0;
    try {
      amountCents = parseRubToCents(createForm.amountRub);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Некорректная сумма");
      return;
    }

    setCreateLoading(true);

    try {
      await apiPost<{ ok: true }>("/api/admin/expenses", {
        title: createForm.title,
        amountCents,
        ...(createForm.expenseDate ? { expenseDate: createForm.expenseDate } : {}),
      });

      setCreateOpen(false);
      setCreateForm(emptyExpenseForm);
      await fetchExpenses({ from: filterFrom || undefined, to: filterTo || undefined });
      showToast("Добавлено");
    } catch (error) {
      const message = getErrorMessage(error);
      setCreateError(message);
      showToast(message, "error");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (expense: Expense): void => {
    setEditingExpense(expense);
    setEditError(null);
    setEditForm({
      title: expense.title,
      amountRub: String(expense.amountCents / 100).replace(".", ","),
      expenseDate: toDateInputValue(expense.expenseDate),
    });
    setEditOpen(true);
  };

  const onEdit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!editingExpense) {
      return;
    }

    setEditError(null);

    let amountCents = 0;
    try {
      amountCents = parseRubToCents(editForm.amountRub);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Некорректная сумма");
      return;
    }

    setEditLoading(true);

    try {
      await apiPatch<{ ok: true }>(`/api/admin/expenses/${editingExpense.id}`, {
        title: editForm.title,
        amountCents,
        expenseDate: editForm.expenseDate,
      });

      setEditOpen(false);
      setEditingExpense(null);
      await fetchExpenses({ from: filterFrom || undefined, to: filterTo || undefined });
      showToast("Сохранено");
    } catch (error) {
      const message = getErrorMessage(error);
      setEditError(message);
      showToast(message, "error");
    } finally {
      setEditLoading(false);
    }
  };

  const onDelete = async (expense: Expense): Promise<void> => {
    if (!window.confirm(`Удалить расход «${expense.title}»?`)) {
      return;
    }

    setDeleteId(expense.id);

    try {
      await apiDelete<{ ok: true }>(`/api/admin/expenses/${expense.id}`);
      await fetchExpenses({ from: filterFrom || undefined, to: filterTo || undefined });
      showToast("Удалено");
    } catch (error) {
      const message = getErrorMessage(error);
      setListError(message);
      showToast(message, "error");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="p-4 sm:p-5">
        <CardHeader className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Расходы мастерской</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">Общие расходы (без привязки к заказу)</p>
          </div>

          <Button size="md" onClick={() => setCreateOpen(true)}>
            Добавить расход
          </Button>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="period-from">Период: от</Label>
              <Input id="period-from" type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="period-to">до</Label>
              <Input id="period-to" type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} />
            </div>
            <Button size="md" variant="secondary" onClick={() => void onApplyPeriod()}>
              Показать
            </Button>
          </div>

          {listError ? <ErrorText>{listError}</ErrorText> : null}
        </CardContent>
      </Card>

      {isListLoading ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Загрузка расходов…</p>
        </Card>
      ) : null}

      {!isListLoading && expenses.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Расходы не найдены</p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardHeader className="mb-2">
              <CardTitle className="text-base">{expense.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-[var(--muted)]">Сумма: {formatRub(expense.amountCents)}</p>
              <p className="text-[var(--muted)]">Дата: {new Date(expense.expenseDate).toLocaleDateString("ru-RU")}</p>
              <p className="text-[var(--muted)]">Добавил: {expense.createdBy.name}</p>
            </CardContent>
            <CardFooter className="mt-0 flex gap-2">
              <Button size="md" variant="secondary" onClick={() => openEdit(expense)}>
                Изменить
              </Button>
              <Button size="md" variant="danger" onClick={() => void onDelete(expense)} loading={deleteId === expense.id} disabled={deleteId === expense.id}>
                Удалить
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onCreate}>
            <SheetHeader>
              <SheetTitle>Добавить расход</SheetTitle>
              <SheetDescription>Укажите название, сумму и дату расхода</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="create-expense-title">Название</Label>
              <Input
                id="create-expense-title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={160}
                required
              />
            </div>

            <div>
              <Label htmlFor="create-expense-amount">Сумма (рубли)</Label>
              <Input
                id="create-expense-amount"
                type="text"
                value={createForm.amountRub}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, amountRub: event.target.value }))}
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <Label htmlFor="create-expense-date">Дата</Label>
              <Input
                id="create-expense-date"
                type="date"
                value={createForm.expenseDate}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, expenseDate: event.target.value }))}
              />
            </div>

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

      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingExpense(null);
            setEditError(null);
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onEdit}>
            <SheetHeader>
              <SheetTitle>Редактировать расход</SheetTitle>
              <SheetDescription>Обновите данные общего расхода</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="edit-expense-title">Название</Label>
              <Input
                id="edit-expense-title"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={160}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-expense-amount">Сумма (рубли)</Label>
              <Input
                id="edit-expense-amount"
                type="text"
                value={editForm.amountRub}
                onChange={(event) => setEditForm((prev) => ({ ...prev, amountRub: event.target.value }))}
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-expense-date">Дата</Label>
              <Input
                id="edit-expense-date"
                type="date"
                value={editForm.expenseDate}
                onChange={(event) => setEditForm((prev) => ({ ...prev, expenseDate: event.target.value }))}
                required
              />
            </div>

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
