import { Badge, Crumbs, PageHeader } from "@/components/ui";
import { AddPersonForm, AddPropertyForm, GiveAccessForm, ResetPasswordForm, type RoleOption } from "@/components/live-admin-forms";
import { ROLE_INFO, SCOPE_LABEL } from "@/lib/role-info";
import { ROLE_HOME } from "@/lib/roles";
import { defaultDb } from "@/lib/live-auth";
import { listPeople, listPropertyChoices, recentAudit } from "@/lib/live-admin";
import type { Role } from "@/lib/roles";
import type { SessionUser } from "@/lib/authz";
import { revokeGrantAction, setActiveAction } from "./live-actions";

const ROLES_FOR_UI: RoleOption[] = (Object.keys(ROLE_INFO) as Role[]).map((id) => ({ id, label: ROLE_INFO[id].label, summary: ROLE_INFO[id].summary, scopes: [...ROLE_INFO[id].scopes], home: ROLE_HOME[id] ?? null }));

export async function LiveAdmin({ user, error }: { user: SessionUser; error?: string }) {
  const db = defaultDb();
  const [people, properties, audit] = await Promise.all([listPeople(user, db), listPropertyChoices(user, db), recentAudit(user, db, 30)]);
  const propName = new Map(properties.map((p) => [p.id, p.name]));
  const where = (g: { scopeType: string; scopeId: string | null }) =>
    g.scopeType === "org" ? "Whole company" : g.scopeType === "property" ? (propName.get(g.scopeId ?? "") ?? g.scopeId) : `${SCOPE_LABEL[g.scopeType as keyof typeof SCOPE_LABEL] ?? g.scopeType}: ${g.scopeId}`;
  return (
    <>
      <Crumbs items={[{ label: "Start here", href: "/" }, { label: "People and access" }]} />
      <PageHeader title="People and access" sub="Add people, choose what each one can see, and switch access off. Changes take effect on their next click." />
      {error ? <p role="alert" className="mb-3 text-sm" style={{ color: "var(--bad)" }}>{error}</p> : null}

      <section className="card mb-4 p-4" aria-labelledby="add">
        <h2 id="add" className="font-semibold">Add a person</h2>
        <p className="muted mt-1 text-sm">Pick a role, then tick the properties they manage. Outside property managers and staff who should only see some parks get one tick per park.</p>
        <AddPersonForm roles={ROLES_FOR_UI} properties={properties} />
      </section>

      <section className="card mb-4 overflow-x-auto p-4" aria-labelledby="who">
        <h2 id="who" className="font-semibold">Who has access ({people.filter((p) => p.active).length} active)</h2>
        <table className="t mt-2" data-testid="people-table">
          <thead><tr><th>Person</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>{p.name}<div className="muted text-xs">{p.email}</div>{p.mustChangePassword ? <div className="text-xs" style={{ color: "var(--warn)" }}>Has not chosen their own password yet</div> : null}</td>
                <td>
                  {p.grants.length === 0 ? <span className="muted text-sm">No access</span> : (
                    <ul className="space-y-1 text-sm">
                      {p.grants.map((g) => (
                        <li key={g.id} className="flex flex-wrap items-center gap-2">
                          <span><strong>{ROLE_INFO[g.role]?.label ?? g.role}</strong> · {where(g)}</span>
                          {p.id !== user.id ? <form action={revokeGrantAction}><input type="hidden" name="grantId" value={g.id} /><button className="btn" aria-label={`Remove ${ROLE_INFO[g.role]?.label ?? g.role} access for ${p.email}`}>Remove</button></form> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.id !== user.id && p.active ? (
                    <details className="mt-2 text-sm"><summary className="cursor-pointer">Give more access</summary><GiveAccessForm userId={p.id} roles={ROLES_FOR_UI} properties={properties} /></details>
                  ) : null}
                </td>
                <td><Badge tone={p.active ? "good" : "muted"}>{p.active ? "active" : "switched off"}</Badge></td>
                <td>
                  {p.id === user.id ? <span className="muted text-sm">You</span> : (
                    <div className="flex flex-col items-start gap-2">
                      <form action={setActiveAction}><input type="hidden" name="userId" value={p.id} /><input type="hidden" name="active" value={p.active ? "false" : "true"} /><button className="btn" aria-label={`${p.active ? "Switch off" : "Switch on"} ${p.email}`}>{p.active ? "Switch off" : "Switch on"}</button></form>
                      {p.active ? <ResetPasswordForm userId={p.id} email={p.email} /> : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="props">
          <h2 id="props" className="font-semibold">Properties ({properties.length})</h2>
          <p className="muted mt-1 text-sm">These are the parks you can tick above. Add a new one when you buy it.</p>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 text-sm sm:grid-cols-2">{properties.map((p) => <li key={p.id}>{p.name}<span className="muted text-xs"> {[p.city, p.state].filter(Boolean).join(", ")}</span></li>)}</ul>
          <AddPropertyForm />
        </section>
        <section className="card p-4" aria-labelledby="aud">
          <h2 id="aud" className="font-semibold">Recent changes</h2>
          <ul className="mt-2 space-y-1 text-xs" data-testid="audit-list">
            {audit.map((a, i) => <li key={i}><span className="muted">{new Date(a.at).toISOString().slice(0, 16).replace("T", " ")}</span> {a.who}: {a.action}{a.target ? ` · ${a.target}` : ""}{a.detail ? ` · ${a.detail}` : ""}</li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
