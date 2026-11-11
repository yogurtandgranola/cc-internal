import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Someone on a temporary password must choose their own before seeing anything.
  if (user.mustChangePassword) redirect("/account");
  return <Shell user={user}>{children}</Shell>;
}
