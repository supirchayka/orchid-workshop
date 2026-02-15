import { notFound } from "next/navigation";
import { OrderDetailsClient } from "./OrderDetailsClient";

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  return <OrderDetailsClient orderId={orderId} />;
}
