import type { OrderStatus } from "@prisma/client";

import type { BadgeVariant } from "@/components/ui/Badge";

export const OrderStatusLabel: Record<OrderStatus, string> = {
  NEW: "Новый",
  IN_PROGRESS: "В работе",
  WAITING_PARTS: "Ожидает запчасти",
  READY_FOR_PICKUP: "Готов к выдаче",
  PAID: "Оплачен",
};

export const OrderStatusBadgeVariant: Record<OrderStatus, BadgeVariant> = {
  NEW: "info",
  IN_PROGRESS: "warning",
  WAITING_PARTS: "danger",
  READY_FOR_PICKUP: "success",
  PAID: "success",
};

export const orderStatusOptions = (Object.keys(OrderStatusLabel) as OrderStatus[]).map((status) => ({
  value: status,
  label: OrderStatusLabel[status],
  badgeVariant: OrderStatusBadgeVariant[status],
}));
