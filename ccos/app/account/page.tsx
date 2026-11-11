import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/app/login/actions";
import { ChangePasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  if (!user.live) redirect("/");
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--forest-mid)" }}>Cornell Communities</p>
      <h1 className="mt-1 text-3xl font-bold">{user.mustChangePassword ? "Choose your password" : "Your account"}</h1>
      <p className="muted mt-2 text-sm">Signed in as {user.email}.</p>
      {user.mustChangePassword ? <p role="status" className="mt-4 rounded-md px-3 py-2 text-sm" style={{ background: "#fde68a", color: "#422006" }}>You are using a temporary password. Choose your own to continue.</p> : null}
      <ChangePasswordForm />
      <div className="mt-6 flex items-center gap-4 text-sm">
        {user.mustChangePassword ? null : <Link href="/">Back to the portal</Link>}
        <form action={logoutAction}><button className="btn">Sign out</button></form>
      </div>
    </main>
  );
}
