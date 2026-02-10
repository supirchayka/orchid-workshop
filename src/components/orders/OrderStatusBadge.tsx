import { OrderStatus } from "@prisma/client";

import { Badge } from "@/components/ui/Badge";
import { OrderStatusBadgeVariant, OrderStatusLabel } from "@/lib/orderStatus";

export function OrderStatusBadge({ status }: { status: OrderStatus }): React.JSX.Element {
  return <Badge variant={OrderStatusBadgeVariant[status]}>{OrderStatusLabel[status]}</Badge>;
}
