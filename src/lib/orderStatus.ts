import { OrderStatus } from "@prisma/client";

export type OrderStatusMeta = {
  label: string;
  badgeVariant: "default" | "info" | "success" | "warning" | "danger";
};

export const orderStatusMeta: Record<OrderStatus, OrderStatusMeta> = {
  NEW: {
    label: "Новый",
    badgeVariant: "info",
  },
  IN_PROGRESS: {
    label: "В работе",
    badgeVariant: "warning",
  },
  WAITING_PARTS: {
    label: "Ожидает запчасти",
    badgeVariant: "default",
  },
  READY_FOR_PICKUP: {
    label: "Готов к выдаче",
    badgeVariant: "success",
  },
  PAID: {
    label: "Оплачен",
    badgeVariant: "success",
  },
};

export const orderStatusOptions = (Object.keys(orderStatusMeta) as OrderStatus[]).map((status) => ({
  value: status,
  ...orderStatusMeta[status],
}));
