import { httpError } from "@/lib/http/errors";

export type OrderStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "READY_FOR_PICKUP"
  | "PAID";

/**
 * Запрещает любые изменения заказа, если он уже оплачен.
 */
export function assertOrderMutable(order: { status: OrderStatus }): void {
  if (order.status === "PAID") {
    throw httpError(409, "Заказ оплачен — изменения запрещены");
  }
}

/**
 * Валидирует смену статуса с учётом admin-only правил для PAID.
 */
export function assertStatusChangeAllowed(params: {
  isAdmin: boolean;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
}): void {
  const { isAdmin, currentStatus, newStatus } = params;

  if (currentStatus === "PAID" && !isAdmin) {
    throw httpError(403, "Только админ может менять статус оплаченного заказа");
  }

  if (newStatus === "PAID" && !isAdmin) {
    throw httpError(403, "Только админ может отметить заказ как оплаченный");
  }
}
