import { requirePermission } from "@/lib/session";
import { getStore } from "@/lib/store";
import { ROLES } from "@/lib/authz";
import { Badge, Crumbs, PageHeader } from "@/components/ui";
import { PROPERTIES, DEALS } from "@/lib/fixtures";
import { rentManagerStub } from "@/lib/connectors/rentmanager";
import { aiConfigAction, deactivateAction, inviteAction, kpiConfigAction, resolveReviewAction, revokeInviteAction, syncAction } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ invite?: string; for?: string; error?: string }> }) {
  const user = await requirePermission("manage_users");
  const sp = await searchParams;
  const s = getStore().state;
  const rm = rentManagerStub();
  const lastSync = [...s.syncRuns].reverse()[0];
  const openReview = s.reviewQueue.filter((r) => r.status === "open");
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Admin" }]} />
      <PageHeader title="Admin" sub="Invitations, access, integrations, models, KPI definitions, and audit history." />
      {sp.error ? <p role="alert" className="mb-3 text-sm" style={{ color: "var(--bad)" }}>{sp.error}</p> : null}
      {sp.invite ? (
        <div className="card mb-4 p-4 text-sm" role="status" data-testid="invite-link">
          <p className="font-semibold">Invitation created for {sp.for}</p>
          <p className="muted mt-1">The portal never sends email on its own. Copy this one-time link and send it yourself. It is shown once and expires in 7 days.</p>
          <code className="mt-2 block break-all">/invite?token={sp.invite}</code>
        </div>
      ) : null}

      <section className="card mb-4 p-4" aria-labelledby="inv">
        <h2 id="inv" className="font-semibold">Invite someone</h2>
        <form action={inviteAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div><label htmlFor="iemail" className="muted block text-xs">Any approved email</label><input id="iemail" name="email" type="email" required /></div>
          <div><label htmlFor="irole" className="muted block text-xs">Role</label><select id="irole" name="role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label htmlFor="iscopet" className="muted block text-xs">Scope</label><select id="iscopet" name="scopeType"><option value="org">org</option><option value="department">department</option><option value="property">property</option><option value="deal">deal</option></select></div>
          <div><label htmlFor="iscope" className="muted block text-xs">Scope id (department, property, or deal id)</label>
            <input id="iscope" name="scopeId" list="scopes" placeholder="e.g. p-cedar or operations" />
            <datalist id="scopes">{["operations", "acquisitions", "ir", ...PROPERTIES.map((p) => p.id), ...DEALS.map((d) => d.id)].map((x) => <option key={x} value={x} />)}</datalist></div>
          <button className="btn btn-primary">Create invitation</button>
        </form>
        <p className="muted mt-2 text-xs">External users such as a VA or outside property manager need no company email and no paid seat.</p>
        {s.invites.length > 0 ? (
          <table className="t mt-3"><thead><tr><th>Email</th><th>Grants</th><th>Status</th><th>Expires</th><th /></tr></thead>
            <tbody>{s.invites.map((i) => (<tr key={i.id}><td>{i.email}</td><td>{i.grants.map((g) => `${g.role}@${g.scopeType}:${g.scopeId ?? "*"}`).join(", ")}</td><td>{i.status}</td><td>{i.expiresAt.slice(0, 10)}</td>
              <td>{i.status === "pending" ? <form action={revokeInviteAction}><input type="hidden" name="id" value={i.id} /><button className="btn">Revoke</button></form> : null}</td></tr>))}</tbody></table>
        ) : null}
      </section>

      <section className="card mb-4 overflow-x-auto p-4" aria-labelledby="usr">
        <h2 id="usr" className="font-semibold">Users and scoped grants</h2>
        <table className="t mt-2" data-testid="user-table">
          <thead><tr><th>User</th><th>Grants</th><th>Status</th><th /></tr></thead>
          <tbody>{s.users.map((u) => (<tr key={u.id}><td>{u.name}<div className="muted text-xs">{u.email}</div></td><td>{u.grants.map((g) => `${g.role}@${g.scopeType}:${g.scopeId ?? "*"}`).join(", ")}</td>
            <td><Badge tone={u.active ? "good" : "muted"}>{u.active ? "active" : "deactivated"}</Badge></td>
            <td>{u.active && u.id !== user.id ? <form action={deactivateAction}><input type="hidden" name="id" value={u.id} /><button className="btn" aria-label={`Deactivate ${u.email}`}>Deactivate</button></form> : null}</td></tr>))}</tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="int">
          <h2 id="int" className="font-semibold">Integration health</h2>
          <table className="t mt-2"><thead><tr><th>Connector</th><th>Mode</th><th>Status</th></tr></thead><tbody>
            <tr><td>Asana (fixture adapter)</td><td>fixture</td><td>{lastSync ? <Badge tone={lastSync.ok ? "good" : "bad"}>{lastSync.ok ? `ok ${lastSync.finishedAt.slice(11, 16)}` : lastSync.errorCategory ?? "error"}</Badge> : <Badge>never run</Badge>}</td></tr>
            <tr><td>Rent Manager</td><td>live</td><td><Badge tone={rm.configured() ? "warn" : "muted"}>{rm.configured() ? "configured, not implemented" : "Not connected"}</Badge></td></tr>
            <tr><td>Notion, Drive, Gmail, GHL, Meow</td><td>n/a</td><td><Badge>Not connected</Badge></td></tr>
          </tbody></table>
          <form action={syncAction} className="mt-3"><button className="btn">Run Asana fixture sync</button></form>
          <p className="muted mt-2 text-xs">Read-only. Repeating the sync does not duplicate records. {s.sourceRecords.length} source records, {s.entityLinks.length} links.</p>
        </section>

        <section className="card p-4" aria-labelledby="rev">
          <h2 id="rev" className="font-semibold">Unresolved matches ({openReview.length})</h2>
          {openReview.length === 0 ? <p className="muted mt-2 text-sm">Nothing waiting for review.</p> : openReview.map((r) => (
            <form key={r.id} action={resolveReviewAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm" data-testid="review-item">
              <input type="hidden" name="id" value={r.id} />
              <span>{r.name}</span>
              <select name="dealId" aria-label={`Match for ${r.name}`}>
                <option value="none">Not a deal in the CRM</option>
                {DEALS.map((d) => <option key={d.id} value={d.id}>{d.name}{r.candidates.some((c) => c.internalId === d.id) ? " (suggested)" : ""}</option>)}
              </select>
              <button className="btn">Resolve</button>
            </form>
          ))}
          <p className="muted mt-2 text-xs">Records are never merged because names look alike. A person decides.</p>
        </section>

        <section className="card p-4" aria-labelledby="ai">
          <h2 id="ai" className="font-semibold">AI model configuration</h2>
          <form action={aiConfigAction} className="mt-2 space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={s.aiConfig.enabled} /> Assistant enabled</label>
            <div><label htmlFor="aip" className="muted block text-xs">Provider (server allow-list)</label><select id="aip" name="provider" defaultValue={s.aiConfig.provider}>{s.aiConfig.allowedProviders.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label htmlFor="ail" className="muted block text-xs">Questions per user per hour</label><input id="ail" name="limit" type="number" min={1} max={200} defaultValue={s.aiConfig.hourlyLimitPerUser} /></div>
            <button className="btn">Save</button>
          </form>
          <p className="muted mt-2 text-xs">{s.aiLog.length} requests logged. Estimated cost ${s.aiLog.reduce((a, r) => a + r.costUsdEst, 0).toFixed(4)}. Provider changes never change data visibility.</p>
        </section>

        <section className="card p-4" aria-labelledby="kpi">
          <h2 id="kpi" className="font-semibold">KPI definitions</h2>
          <form action={kpiConfigAction} className="mt-2 flex flex-wrap items-end gap-3 text-sm">
            <div><label htmlFor="kp" className="muted block text-xs">Collections pass (%)</label><input id="kp" name="pass" type="number" step="0.1" defaultValue={s.kpiConfig.collectionsPass} /></div>
            <div><label htmlFor="kr" className="muted block text-xs">Red below (%)</label><input id="kr" name="red" type="number" step="0.1" defaultValue={s.kpiConfig.collectionsRed} /></div>
            <button className="btn">Save</button>
          </form>
          <p className="muted mt-2 text-xs">Full dictionary with formulas: docs/kpi-dictionary.md. Other thresholds are proposed until approved.</p>
        </section>
      </div>

      <section className="card mt-4 overflow-x-auto p-4" aria-labelledby="aud">
        <h2 id="aud" className="font-semibold">Audit history</h2>
        <table className="t mt-2" data-testid="audit-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>{s.audit.slice(0, 40).map((a) => (<tr key={a.id}><td>{a.at.slice(0, 19).replace("T", " ")}</td><td>{a.actor}</td><td>{a.action}{a.ok ? "" : " (failed)"}</td><td>{a.target ?? ""}</td><td>{a.detail ?? ""}</td></tr>))}</tbody></table>
      </section>
    </>
  );
}
