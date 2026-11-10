import { acceptInviteAction } from "./actions";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Accept your invitation</h1>
      <p className="muted mt-2 text-sm">Choose a name and a password of at least 12 characters.</p>
      {error ? <p role="alert" className="mt-4 text-sm" style={{ color: "var(--bad)" }}>{error}</p> : null}
      <form action={acceptInviteAction} className="card mt-4 space-y-4 p-5">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="name" className="block text-sm font-medium">Your name</label>
          <input id="name" name="name" required className="mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" required className="mt-1 w-full" />
        </div>
        <button className="btn btn-primary w-full">Create account</button>
      </form>
    </main>
  );
}
