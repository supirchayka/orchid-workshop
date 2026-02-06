import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth/session";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <AppShell session={session}>{children}</AppShell>;
}
