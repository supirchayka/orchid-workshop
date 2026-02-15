import { httpError, toHttpError } from "@/lib/http/errors";

export async function POST() {
  try {
    return httpError(400, "Расходы в заказе отключены. Добавляйте только общие расходы мастерской.");
  } catch (e) {
    return toHttpError(e);
  }
}
