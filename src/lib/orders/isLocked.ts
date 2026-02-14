import type { OrderStatus } from "@prisma/client";

export function isPaidLocked(order: { status: OrderStatus }): boolean {
  return order.status === "PAID";
}
