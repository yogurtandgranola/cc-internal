"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card mt-4 space-y-4 p-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="mt-1 w-full" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="mt-1 w-full" />
      </div>
      {state?.error ? <p role="alert" className="text-sm" style={{ color: "var(--bad)" }}>{state.error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
