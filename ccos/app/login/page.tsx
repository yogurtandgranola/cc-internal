import { LoginForm } from "./form";
import { DEMO_PASSWORD, SEED_USERS } from "@/lib/fixtures";

export default function LoginPage() {
  const live = process.env.CCOS_MODE === "live" || process.env.NODE_ENV === "production";
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>Cornell Communities</p>
      <h1 className="mt-1 text-3xl font-bold">Operating portal</h1>
      <p className="muted mt-2 text-sm">Invitation only. There is no sign-up.</p>
      {live ? (
        <div className="card mt-8 p-5 text-sm" role="alert">
          <p className="font-semibold">Live sign-in is not configured.</p>
          <p className="muted mt-1">Mock authentication is disabled in live and production modes. Connect Supabase Auth to enable real sign-in (see docs/connection-status.md).</p>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-md px-3 py-2 text-xs font-semibold" style={{ background: "#fde68a", color: "#422006" }}>
            DEMO DATA. Synthetic accounts for local testing only.
          </div>
          <LoginForm />
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer">Demo accounts (password: {DEMO_PASSWORD})</summary>
            <ul className="muted mt-2 space-y-1">
              {SEED_USERS.map((u) => (
                <li key={u.email}><code>{u.email}</code> · {u.grants[0]?.role}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </main>
  );
}
