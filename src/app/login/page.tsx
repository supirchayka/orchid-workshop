"use client";

import { useState } from "react";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.message ?? "Ошибка входа");
      setLoading(false);
      return;
    }

    window.location.href = "/orders";
  }

  return (
    <main className="min-h-[100dvh] ios-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="ios-card p-6 sm:p-7">
          {/* Заголовок */}
          <div className="mb-6">
            <div className="text-[22px] font-semibold tracking-tight">
              Orchid — учёт заказов
            </div>
            <div className="mt-1 text-sm ios-muted">
              Войдите, чтобы продолжить работу
            </div>
          </div>

          {/* Форма */}
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-2">
              <div className="ios-label">Имя</div>
              <input
                className="ios-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="например: admin"
                autoComplete="username"
                inputMode="text"
              />
            </label>

            <label className="block space-y-2">
              <div className="ios-label">Пароль</div>
              <input
                className="ios-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error && (
              <div className="text-sm ios-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ios-button-primary disabled:opacity-60"
            >
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>

          {/* Низ */}
          <div className="mt-6 text-xs ios-muted">
            Если нет доступа — попросите админа создать пользователя.
          </div>
        </div>
      </div>
    </main>
  );
}
