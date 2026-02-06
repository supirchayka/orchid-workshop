import { httpError } from "@/lib/http/errors";

export type OrderStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "READY_FOR_PICKUP"
  | "PAID";

export function assertOrderMutable(order: { status: OrderStatus }): void {
  if (order.status === "PAID") {
    throw httpError(409, "Заказ оплачен — изменения запрещены");
  }
}

export function assertStatusChangeAllowed(params: {
  isAdmin: boolean;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
}): void {
  const { isAdmin, currentStatus, newStatus } = params;

  if (currentStatus === "PAID") {
    if (!isAdmin) {
      throw httpError(403, "Только админ может менять статус оплаченного заказа");
    }

    return;
  }

  if (newStatus === "PAID") {
    if (!isAdmin) {
      throw httpError(403, "Только админ может отметить заказ как оплаченный");
    }

    return;
  }
}
