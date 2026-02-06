import { getSession, type Session } from "@/lib/auth/session";
import { httpError } from "@/lib/http/errors";

/**
 * Возвращает текущую сессию или выбрасывает 401, если вход не выполнен.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw httpError(401, "Требуется вход");
  }

  return session;
}

/**
 * Проверяет права администратора и выбрасывает 403 при их отсутствии.
 */
export function requireAdmin(session: Session): void {
  if (session.isAdmin !== true) {
    throw httpError(403, "Недостаточно прав");
  }
}
