import { LoginForm } from "./form";
import { DEMO_PASSWORD, SEED_USERS } from "@/lib/fixtures";
import { hostedDemoEnabled, mockAuthAllowed } from "@/lib/auth";
import { liveAuthConfigured } from "@/lib/live-auth";

// Evaluated per request, so the environment decides, not the build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const demoOn = mockAuthAllowed();
  const liveOn = liveAuthConfigured();
  const hosted = hostedDemoEnabled();
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--forest-mid)" }}>Cornell Communities</p>
      <h1 className="mt-1 text-3xl font-bold">Operating portal</h1>
      <p className="muted mt-2 text-sm">Invitation only. There is no sign-up.</p>
      {!demoOn && !liveOn ? (
        <div className="card mt-8 p-5 text-sm" role="alert">
          <p className="font-semibold">Sign-in is not set up.</p>
          <p className="muted mt-1">Connect Supabase to turn on real sign-in (see docs/connection-status.md).</p>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-md px-3 py-2 text-xs font-semibold" style={{ background: "#fde68a", color: "#422006" }}>
            {hosted ? "DEMO DATA. Every record in this portal is fictional." : demoOn ? "DEMO DATA. Synthetic accounts for local testing only." : "SAMPLE DATA. Live data is not connected yet."}
          </div>
          <LoginForm />
          {liveOn ? <p className="muted mt-6 text-sm">Team members: sign in with your own email and password. Records stay fictional until live data is connected.</p> : null}
          {hosted ? (
            <p className="muted mt-3 text-sm">Testing the demo? Ask the person who shared this link for the demo account and password. Demo changes may reset.</p>
          ) : demoOn ? (
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer">Demo accounts (password: {DEMO_PASSWORD})</summary>
            <ul className="muted mt-2 space-y-1">
              {SEED_USERS.map((u) => (
                <li key={u.email}><code>{u.email}</code> · {u.grants[0]?.role}</li>
              ))}
            </ul>
          </details>
          ) : null}
        </>
      )}
    </main>
  );
}
