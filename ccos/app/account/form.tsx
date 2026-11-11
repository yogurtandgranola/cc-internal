"use client";
import { useActionState } from "react";
import { changePasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="card mt-4 space-y-4 p-5">
      <div><label htmlFor="current" className="block text-sm font-medium">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="mt-1 w-full" /></div>
      <div><label htmlFor="next" className="block text-sm font-medium">New password (12 or more characters)</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required className="mt-1 w-full" /></div>
      <div><label htmlFor="confirm" className="block text-sm font-medium">New password again</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className="mt-1 w-full" /></div>
      {state?.error ? <p role="alert" className="text-sm" style={{ color: "var(--bad)" }}>{state.error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}
