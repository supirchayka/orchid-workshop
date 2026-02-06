import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/http/cookies";
import { verifyToken } from "@/lib/auth/jwt";

export type Session = {
  userId: string;
  name: string;
  isAdmin: boolean;
};

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies(); // ✅ важно
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    return {
      userId: payload.sub,
      name: payload.name,
      isAdmin: payload.isAdmin,
    };
  } catch {
    return null;
  }
}
