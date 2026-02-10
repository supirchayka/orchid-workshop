import { OrderStatus } from "@prisma/client";

export function isPaidLocked(order: { status: OrderStatus }): boolean {
  return order.status === OrderStatus.PAID;
}
