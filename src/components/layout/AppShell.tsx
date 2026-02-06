"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import type { Session } from "@/lib/auth/session";

type NavItem = {
  href: string;
  label: string;
  sectionTitle: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/orders", label: "Заказы", sectionTitle: "Заказы" },
  { href: "/me/commission", label: "Моя комиссия", sectionTitle: "Моя комиссия" },
  { href: "/admin/analytics", label: "Аналитика", sectionTitle: "Аналитика", adminOnly: true },
  { href: "/admin/users", label: "Пользователи", sectionTitle: "Пользователи", adminOnly: true },
  { href: "/admin/services", label: "Услуги", sectionTitle: "Услуги", adminOnly: true },
  { href: "/admin/expenses", label: "Расходы", sectionTitle: "Расходы", adminOnly: true },
];

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ session, children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const visibleItems = useMemo(
    () => navItems.filter((item) => !item.adminOnly || session.isAdmin),
    [session.isAdmin],
  );

  const activeItem = visibleItems.find((item) => isActivePath(pathname, item.href));
  const sectionTitle = activeItem?.sectionTitle ?? "Раздел";

  async function onLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="ios-bg min-h-[100dvh] pb-24">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/55 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">{sectionTitle}</p>
            <p className="text-xs text-[var(--muted)]">{session.name}</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="rounded-[12px] border border-white/10 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            {loggingOut ? "Выход..." : "Выйти"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-1 px-3 py-2 sm:grid-cols-3 md:grid-cols-6">
          {visibleItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-[12px] px-2 text-center text-xs font-medium transition",
                    active
                      ? "bg-[var(--surface-2)] text-[var(--text)]"
                      : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
