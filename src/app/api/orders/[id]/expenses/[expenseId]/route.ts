import { httpError, toHttpError } from "@/lib/http/errors";

const message = "Расходы в заказе отключены. Редактируйте только общие расходы мастерской.";

export async function PATCH() {
  try {
    return httpError(400, message);
  } catch (e) {
    return toHttpError(e);
  }
}

export async function DELETE() {
  try {
    return httpError(400, message);
  } catch (e) {
    return toHttpError(e);
  }
}
