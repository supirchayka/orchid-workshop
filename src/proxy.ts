import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/http/cookies";
import { verifyToken } from "@/lib/auth/jwt";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Нет токена → на /login
  if (!token) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Токен есть, но битый/просрочен → чистим и на /login
  try {
    await verifyToken(token);
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }

  // Если залогинен и пришёл на /login → на /orders
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/orders", request.url));
  }

  return NextResponse.next();
}

// Не запускаем proxy на статике/картинках/и т.п.
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
