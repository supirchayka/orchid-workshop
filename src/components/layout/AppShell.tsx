"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { apiPost } from "@/lib/http/api";

type NavItem = {
  href: string;
  label: string;
  sectionTitle: string;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
};

const navItems: NavItem[] = [
  { href: "/orders", label: "\u0417\u0430\u043a\u0430\u0437\u044b", sectionTitle: "\u0417\u0430\u043a\u0430\u0437\u044b" },
  {
    href: "/me/commission",
    label: "\u041c\u043e\u044f \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044f",
    sectionTitle: "\u041c\u043e\u044f \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044f",
    hideForAdmin: true,
  },
  {
    href: "/admin/analytics",
    label: "\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430",
    sectionTitle: "\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430",
    adminOnly: true,
  },
  {
    href: "/admin/users",
    label: "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438",
    sectionTitle: "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438",
    adminOnly: true,
  },
  { href: "/admin/services", label: "\u0423\u0441\u043b\u0443\u0433\u0438", sectionTitle: "\u0423\u0441\u043b\u0443\u0433\u0438", adminOnly: true },
  { href: "/admin/expenses", label: "\u0420\u0430\u0441\u0445\u043e\u0434\u044b", sectionTitle: "\u0420\u0430\u0441\u0445\u043e\u0434\u044b", adminOnly: true },
];

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark(): React.JSX.Element {
  return (
    <p className="text-[27px] font-semibold tracking-tight text-[var(--text)]">
      <span>{"\u041c\u0430\u0441\u0442\u0435\u0440"}</span>
      <span className="ml-2 inline-flex rounded-lg bg-[#FF8C0F] px-2.5 py-0.5 font-bold text-black">Hub</span>
    </p>
  );
}

export function AppShell({ session, children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) => (!item.adminOnly || session.isAdmin) && !(item.hideForAdmin && session.isAdmin)),
    [session.isAdmin],
  );

  const activeItem = visibleItems.find((item) => isActivePath(pathname, item.href));
  const sectionTitle = activeItem?.sectionTitle ?? (isActivePath(pathname, "/orders") ? "\u0417\u0430\u043a\u0430\u0437\u044b" : "\u0420\u0430\u0437\u0434\u0435\u043b");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function onLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await apiPost<{ ok: true }>("/api/auth/logout");
    } finally {
      router.replace("/login");
    }
  }

  const navList = (
    <ul className="space-y-1.5">
      {visibleItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "glass-hover flex min-h-11 items-center rounded-2xl border-none px-3.5 text-sm font-medium tracking-[0.01em]",
                active
                  ? "border-transparent bg-[linear-gradient(135deg,rgba(255,140,15,0.26),rgba(255,140,15,0.12))] text-[var(--text)] shadow-[0_10px_22px_rgba(0,0,0,0.28)]"
                  : "border-transparent bg-white/[0.02] text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--text)]",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <ToastProvider>
      <div className="ios-bg min-h-[100dvh]">
        <div className="flex min-h-[100dvh] w-full">
          <aside className="hidden w-[300px] shrink-0 flex-col justify-between overflow-y-auto bg-black/20 p-5 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen">
            <div>
              <div className="mb-6 rounded-[24px] bg-white/[0.04] px-4 py-4 text-center shadow-[var(--panel-shadow)]">
                <BrandMark />
              </div>
              <nav aria-label={"\u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f"}>{navList}</nav>
            </div>

            <div className="space-y-3 pt-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-2)]">{"\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c"}</p>
                <p className="text-sm font-medium text-[var(--text)]">{session.name}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="glass-hover flex h-11 w-full items-center justify-center rounded-xl border-none bg-white/[0.08] px-3 text-sm font-medium text-[var(--text)] backdrop-blur-xl disabled:opacity-60"
              >
                {loggingOut ? "\u0412\u044b\u0445\u043e\u0434..." : "\u0412\u044b\u0439\u0442\u0438"}
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-2xl lg:bg-transparent">
              <div className="flex h-16 w-full items-center justify-between gap-3 px-4 lg:h-20 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    aria-label={mobileMenuOpen ? "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e" : "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e"}
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    className="glass-hover relative inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-none bg-white/[0.08] text-[var(--text)] backdrop-blur-xl lg:hidden"
                  >
                    <span className={cn("block h-0.5 w-4 rounded-full bg-current transition", mobileMenuOpen && "translate-y-1.5 rotate-45")} />
                    <span
                      className={cn(
                        "absolute left-1/2 top-1/2 block h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition",
                        mobileMenuOpen && "opacity-0",
                      )}
                    />
                    <span className={cn("block h-0.5 w-4 rounded-full bg-current transition", mobileMenuOpen && "-translate-y-1.5 -rotate-45")} />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-tight">{sectionTitle}</p>
                    <p className="truncate text-xs text-[var(--muted)] lg:hidden">{session.name}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  disabled={loggingOut}
                  className="glass-hover rounded-xl border-none bg-white/[0.08] px-3 py-2 text-sm font-medium text-[var(--text)] backdrop-blur-xl disabled:opacity-60 lg:hidden"
                >
                  {loggingOut ? "\u0412\u044b\u0445\u043e\u0434..." : "\u0412\u044b\u0439\u0442\u0438"}
                </button>
              </div>
            </header>

            <main className="anim-page-in w-full flex-1 px-4 py-6 lg:px-8">{children}</main>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label={"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e"}
              className="absolute inset-0 h-full w-full bg-black/64 backdrop-blur-[2px]"
              onClick={() => setMobileMenuOpen(false)}
            />

            <aside className="ios-card anim-page-in absolute left-0 top-0 h-full w-[min(84vw,340px)] rounded-l-none rounded-r-[24px] border-none px-4 py-5">
              <div className="mb-5 flex items-start justify-between gap-2 text-center">
                <BrandMark />
                <button
                  type="button"
                  aria-label={"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="glass-hover inline-flex h-10 w-10 items-center justify-center rounded-xl border-none bg-white/[0.08] text-[var(--text)] backdrop-blur-xl"
                >
                  <span className="text-lg leading-none">x</span>
                </button>
              </div>

              <nav aria-label={"\u041c\u043e\u0431\u0438\u043b\u044c\u043d\u0430\u044f \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f"}>{navList}</nav>
            </aside>
          </div>
        ) : null}
      </div>
    </ToastProvider>
  );
}
