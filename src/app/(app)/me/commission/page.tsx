import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

import { CommissionClient } from "./CommissionClient";

export default async function MyCommissionPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.isAdmin) {
    redirect("/orders");
  }

  return <CommissionClient />;
}
