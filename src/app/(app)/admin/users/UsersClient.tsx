"use client";

import * as React from "react";

import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorText, HelperText, Input, Label } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/http/api";

type User = {
  id: number;
  name: string;
  isAdmin: boolean;
  isActive: boolean;
  commissionPct: number;
  createdAt: string;
  updatedAt: string;
};

type MeResponse = {
  ok: true;
  me: {
    id: number;
    name: string;
    isAdmin: boolean;
  };
};

type CreateForm = {
  name: string;
  password: string;
  commissionPct: string;
  isAdmin: boolean;
  isActive: boolean;
};

type EditForm = {
  commissionPct: string;
  isAdmin: boolean;
  isActive: boolean;
};

export function UsersClient(): React.JSX.Element {
  const { showToast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [listError, setListError] = React.useState<string | null>(null);
  const [isListLoading, setIsListLoading] = React.useState(true);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateForm>({
    name: "",
    password: "",
    commissionPct: "0",
    isAdmin: false,
    isActive: true,
  });

  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editForm, setEditForm] = React.useState<EditForm>({
    commissionPct: "0",
    isAdmin: false,
    isActive: true,
  });

  const [passwordUser, setPasswordUser] = React.useState<User | null>(null);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordValue, setPasswordValue] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = React.useState(false);

  const fetchUsers = React.useCallback(async () => {
    setIsListLoading(true);
    setListError(null);

    try {
      const data = await apiGet<{ ok: true; users: User[] }>("/api/admin/users");
      setUsers(data.users);
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setIsListLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  React.useEffect(() => {
    let active = true;

    const fetchMe = async (): Promise<void> => {
      try {
        const data = await apiGet<MeResponse>("/api/me");
        if (active) {
          setCurrentUserId(data.me.id);
        }
      } catch {
        // no-op
      }
    };

    void fetchMe();

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return users;
    }

    return users.filter((user) => user.name.toLowerCase().includes(normalized));
  }, [users, search]);

  const onCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      await apiPost<{ ok: true }>("/api/admin/users", {
        name: createForm.name,
        password: createForm.password,
        commissionPct: createForm.isAdmin ? 0 : Number(createForm.commissionPct),
        isAdmin: createForm.isAdmin,
        isActive: createForm.isActive,
      });

      setCreateOpen(false);
      setCreateForm({ name: "", password: "", commissionPct: "0", isAdmin: false, isActive: true });
      await fetchUsers();
      showToast("Добавлено");
    } catch (error) {
      const message = getErrorMessage(error);
      setCreateError(message);
      showToast(message, "error");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (user: User): void => {
    setEditingUser(user);
    setEditForm({
      commissionPct: String(user.commissionPct),
      isAdmin: user.isAdmin,
      isActive: user.isActive,
    });
    setEditError(null);
    setEditOpen(true);
  };

  const isEditingSelf = editingUser?.id === currentUserId;

  const onEdit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    setEditError(null);
    setEditLoading(true);

    try {
      await apiPatch<{ ok: true }>(`/api/admin/users/${editingUser.id}`, {
        commissionPct: editForm.isAdmin ? 0 : Number(editForm.commissionPct),
        isAdmin: editForm.isAdmin,
        isActive: editForm.isActive,
      });

      setEditOpen(false);
      setEditingUser(null);
      await fetchUsers();
      showToast("Сохранено");
    } catch (error) {
      const message = getErrorMessage(error);
      setEditError(message);
      showToast(message, "error");
    } finally {
      setEditLoading(false);
    }
  };

  const openPassword = (user: User): void => {
    setPasswordUser(user);
    setPasswordValue("");
    setPasswordError(null);
    setPasswordOpen(true);
  };

  const onResetPassword = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!passwordUser) {
      return;
    }

    setPasswordError(null);
    setPasswordLoading(true);

    try {
      await apiPost<{ ok: true }>(`/api/admin/users/${passwordUser.id}/password`, { password: passwordValue });

      setPasswordOpen(false);
      setPasswordUser(null);
      setPasswordValue("");
      showToast("Сохранено");
    } catch (error) {
      const message = getErrorMessage(error);
      setPasswordError(message);
      showToast(message, "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="p-4 sm:p-5">
        <CardHeader className="mb-3 flex items-center justify-between">
          <div>
            <CardTitle>Пользователи</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">Управление доступами и комиссией</p>
          </div>
          <Button size="md" onClick={() => setCreateOpen(true)}>
            Создать пользователя
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="users-search">Поиск по имени</Label>
            <Input
              id="users-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Например: мастер"
            />
          </div>
          {listError ? <ErrorText>{listError}</ErrorText> : null}
        </CardContent>
      </Card>

      {isListLoading ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Загрузка пользователей…</p>
        </Card>
      ) : null}

      {!isListLoading && filteredUsers.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Пользователи не найдены</p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <CardHeader className="mb-3 flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{user.name}</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {user.isAdmin ? "Админ" : "Пользователь"} • Комиссия: {user.commissionPct}%
                </p>
              </div>
              <Badge variant={user.isActive ? "success" : "danger"}>{user.isActive ? "Активен" : "Неактивен"}</Badge>
            </CardHeader>
            <CardFooter className="mt-0 flex-wrap gap-2">
              <Button size="md" variant="secondary" onClick={() => openEdit(user)}>
                Изменить
              </Button>
              <Button size="md" variant="ghost" onClick={() => openPassword(user)}>
                Сбросить пароль
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onCreate}>
            <SheetHeader>
              <SheetTitle>Создать пользователя</SheetTitle>
              <SheetDescription>Заполните данные нового пользователя</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="create-name">Имя</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="create-password">Пароль</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                minLength={6}
                required
              />
            </div>

            <div>
              <Label htmlFor="create-commission">Комиссия (%)</Label>
              <Input
                id="create-commission"
                type="number"
                min={0}
                max={100}
                value={createForm.commissionPct}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, commissionPct: event.target.value }))}
                disabled={createForm.isAdmin}
                required
              />
              {createForm.isAdmin ? <HelperText>Для администраторов комиссия всегда 0%.</HelperText> : null}
            </div>

            <label className="flex h-11 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm">
              <input
                type="checkbox"
                checked={createForm.isAdmin}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    isAdmin: event.target.checked,
                    commissionPct: event.target.checked ? "0" : prev.commissionPct,
                  }))
                }
                className="h-4 w-4"
              />
              Админ
            </label>

            <label className="flex h-11 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4"
              />
              Активен
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
              <SheetTitle>Изменить пользователя</SheetTitle>
              <SheetDescription>{editingUser ? `Пользователь: ${editingUser.name}` : ""}</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="edit-commission">Комиссия (%)</Label>
              <Input
                id="edit-commission"
                type="number"
                min={0}
                max={100}
                value={editForm.commissionPct}
                onChange={(event) => setEditForm((prev) => ({ ...prev, commissionPct: event.target.value }))}
                disabled={editForm.isAdmin}
                required
              />
              {editForm.isAdmin ? <HelperText>Для администраторов комиссия всегда 0%.</HelperText> : null}
            </div>

            <label className="flex h-11 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm">
              <input
                type="checkbox"
                checked={editForm.isAdmin}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    isAdmin: event.target.checked,
                    commissionPct: event.target.checked ? "0" : prev.commissionPct,
                  }))
                }
                className="h-4 w-4"
              />
              Админ
            </label>

            <label className="flex h-11 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4"
              />
              Активен
            </label>

            {isEditingSelf ? (
              <p className="text-xs text-[var(--muted)]">
                Вы редактируете свою учётную запись. Ограничения безопасности применяются автоматически.
              </p>
            ) : null}

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

      <Sheet open={passwordOpen} onOpenChange={setPasswordOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <form className="space-y-3" onSubmit={onResetPassword}>
            <SheetHeader>
              <SheetTitle>Сброс пароля</SheetTitle>
              <SheetDescription>{passwordUser ? `Пользователь: ${passwordUser.name}` : ""}</SheetDescription>
            </SheetHeader>

            <div>
              <Label htmlFor="new-password">Новый пароль</Label>
              <Input
                id="new-password"
                type="password"
                minLength={6}
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                required
              />
            </div>

            {passwordError ? <ErrorText>{passwordError}</ErrorText> : null}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)} disabled={passwordLoading}>
                Отмена
              </Button>
              <Button type="submit" loading={passwordLoading}>
                Обновить пароль
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}

