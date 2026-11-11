"use client";
import { useActionState, useState } from "react";
import { addGrantsAction, addPersonAction, addPropertyAction, resetPasswordAction } from "@/app/(app)/admin/live-actions";
import type { FormState } from "@/lib/admin-form";

export type RoleOption = { id: string; label: string; summary: string; scopes: string[]; home: string | null };
export type PropertyOption = { id: string; name: string; city: string | null; state: string | null };
const SCOPE_LABEL: Record<string, string> = { org: "Whole company", department: "A department", property: "Specific properties", deal: "A specific deal", investor: "A specific investor" };
const DEPTS = ["operations", "acquisitions", "ir", "executive"];

function Result({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="mt-2 text-sm" style={{ color: "var(--bad)" }}>{state.error}</p>;
  return (
    <div role="status" className="mt-2 text-sm">
      {state.ok ? <p style={{ color: "var(--good)" }}>{state.ok}</p> : null}
      {state.tempPassword ? (
        <div className="card mt-2 p-3" data-testid="temp-password-box">
          <p className="font-semibold">Temporary password for {state.email}</p>
          <code data-testid="temp-password" className="mt-1 block text-base select-all">{state.tempPassword}</code>
          <p className="muted mt-1 text-xs">Send it to them privately, by phone or a secure message. It is shown once and is not saved anywhere. They must choose their own password the first time they sign in.</p>
        </div>
      ) : null}
    </div>
  );
}

// Role, then where it applies. Property access is a list of checkboxes, so one person can hold several parks.
function AccessFields({ roles, properties, idPrefix }: { roles: RoleOption[]; properties: PropertyOption[]; idPrefix: string }) {
  const [roleId, setRoleId] = useState("ops_staff");
  const role = roles.find((r) => r.id === roleId) ?? roles[0]!;
  const [scope, setScope] = useState<string>("");
  const scopeType = role.scopes.includes(scope) ? scope : role.scopes[0]!;
  const depts = role.home ? [role.home] : DEPTS;
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-role`} className="muted block text-xs">Role</label>
        <select id={`${idPrefix}-role`} name="role" value={roleId} onChange={(e) => { setRoleId(e.target.value); setScope(""); }}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <p className="muted mt-1 max-w-xs text-xs">{role.summary}</p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-scope`} className="muted block text-xs">Applies to</label>
        <select id={`${idPrefix}-scope`} name="scopeType" value={scopeType} onChange={(e) => setScope(e.target.value)}>
          {role.scopes.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s] ?? s}</option>)}
        </select>
      </div>
      {scopeType === "property" ? (
        <fieldset className="max-w-md">
          <legend className="muted text-xs">Tick the properties they can see</legend>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {properties.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="scopeId" value={p.id} />{p.name}{p.state ? <span className="muted text-xs"> {p.state}</span> : null}</label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {scopeType === "department" ? (
        <div>
          <label htmlFor={`${idPrefix}-dept`} className="muted block text-xs">Department</label>
          <select id={`${idPrefix}-dept`} name="scopeId">{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      ) : null}
      {scopeType === "deal" || scopeType === "investor" ? (
        <div>
          <label htmlFor={`${idPrefix}-id`} className="muted block text-xs">{scopeType === "deal" ? "Deal id" : "Investor id"}</label>
          <input id={`${idPrefix}-id`} name="scopeId" required />
        </div>
      ) : null}
      {scopeType === "org" ? <p className="muted text-xs">Applies to the whole company.</p> : null}
    </>
  );
}

export function AddPersonForm({ roles, properties }: { roles: RoleOption[]; properties: PropertyOption[] }) {
  const [state, action, pending] = useActionState(addPersonAction, undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-start gap-4">
      <div><label htmlFor="np-name" className="muted block text-xs">Name</label><input id="np-name" name="name" required autoComplete="off" /></div>
      <div><label htmlFor="np-email" className="muted block text-xs">Email</label><input id="np-email" name="email" type="email" required autoComplete="off" /></div>
      <AccessFields roles={roles} properties={properties} idPrefix="np" />
      <div className="self-end"><button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add person"}</button></div>
      <div className="w-full"><Result state={state} /></div>
    </form>
  );
}

export function GiveAccessForm({ userId, roles, properties }: { userId: string; roles: RoleOption[]; properties: PropertyOption[] }) {
  const [state, action, pending] = useActionState(addGrantsAction, undefined);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-start gap-4">
      <input type="hidden" name="userId" value={userId} />
      <AccessFields roles={roles} properties={properties} idPrefix={`g-${userId}`} />
      <div className="self-end"><button className="btn" disabled={pending}>{pending ? "Saving…" : "Give access"}</button></div>
      <div className="w-full"><Result state={state} /></div>
    </form>
  );
}

export function ResetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="userId" value={userId} />
      <button className="btn" disabled={pending} aria-label={`Reset password for ${email}`}>{pending ? "Working…" : "Reset password"}</button>
      <Result state={state} />
    </form>
  );
}

export function AddPropertyForm() {
  const [state, action, pending] = useActionState(addPropertyAction, undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div><label htmlFor="pp-name" className="muted block text-xs">Property name</label><input id="pp-name" name="name" required /></div>
      <div><label htmlFor="pp-city" className="muted block text-xs">City</label><input id="pp-city" name="city" /></div>
      <div><label htmlFor="pp-state" className="muted block text-xs">State (2 letters)</label><input id="pp-state" name="state" maxLength={2} className="w-20" /></div>
      <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add property"}</button>
      <div className="w-full"><Result state={state} /></div>
    </form>
  );
}
