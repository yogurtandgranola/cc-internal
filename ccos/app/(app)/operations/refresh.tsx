"use client";
import { useActionState } from "react";
import { refreshRentManagerAction, type RefreshState } from "./actions";

export function RefreshButton() {
  const [state, action, pending] = useActionState(async () => refreshRentManagerAction(), undefined as RefreshState);
  return (
    <form action={action} className="mb-4 flex flex-wrap items-center gap-3">
      <button className="btn btn-primary" disabled={pending}>{pending ? "Refreshing…" : "Refresh from Rent Manager now"}</button>
      {state?.ok ? <p role="status" className="text-sm">{state.ok}</p> : null}
      {state?.error ? <p role="alert" className="text-sm" style={{ color: "var(--bad)" }}>{state.error}</p> : null}
    </form>
  );
}
