import { OrderDetailsClient } from "./OrderDetailsClient";

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;

  return <OrderDetailsClient orderId={id} />;
}
