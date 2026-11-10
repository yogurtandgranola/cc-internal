-- Row Level Security. Default deny: no policy means no rows. Nothing is granted to anon.
-- App code must use the user-scoped client. A service key bypasses all of this and is reserved for
-- server-only invitation and ingestion jobs.

-- ---- permission engine ----
create or replace function app.can_row(perm text, rtype text, rid text, dept text, prop text, deal text, ent text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_role_grants g
    join public.profiles p on p.id = g.user_id and p.active
    join public.role_permissions rp on rp.role = g.role and rp.permission = perm
    left join public.role_home_department h on h.role = g.role
    where g.user_id = auth.uid()
      and g.revoked_at is null
      and (h.department is null or h.department = dept)
      and (
        g.scope_type = 'org'
        or (g.scope_type = 'department' and g.scope_id = dept)
        or (g.scope_type = 'property' and (g.scope_id = prop or (rtype = 'property' and g.scope_id = rid)))
        or (g.scope_type = 'deal' and (g.scope_id = deal or (rtype = 'deal' and g.scope_id = rid)))
        or (g.scope_type = 'legal_entity' and g.scope_id = ent)
        or (g.scope_type = 'investor' and rtype = 'investor' and g.scope_id = rid)
      )
  );
$$;

create or replace function app.can_resource(perm text, rtype text, rid text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.resource_scopes s where s.resource_type = rtype and s.resource_id = rid
    and app.can_row(perm, rtype, rid, s.department, s.property_id, s.deal_id, s.entity_id));
$$;

create or replace function app.can_org(perm text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.user_role_grants g
    join public.profiles p on p.id = g.user_id and p.active
    join public.role_permissions rp on rp.role = g.role and rp.permission = perm
    where g.user_id = auth.uid() and g.revoked_at is null and g.scope_type = 'org');
$$;

create or replace function app.is_active() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active); $$;

-- Only an org-scoped owner may hand out owner_admin. Used by the grants policy below.
create or replace function app.is_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.user_role_grants g join public.profiles p on p.id = g.user_id and p.active
  where g.user_id = auth.uid() and g.role = 'owner_admin' and g.scope_type = 'org' and g.revoked_at is null); $$;

-- ---- enable RLS everywhere and revoke default privileges ----
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
revoke all on schema app from anon;
grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
grant usage on schema public to authenticated;

-- ---- reference data: readable by any active user ----
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
create policy ref_roles on public.roles for select to authenticated using (app.is_active());
create policy ref_perms on public.permissions for select to authenticated using (app.is_active());
create policy ref_rp on public.role_permissions for select to authenticated using (app.is_active());

-- ---- identity ----
grant select on public.organizations, public.profiles, public.user_role_grants to authenticated;
create policy org_member on public.organizations for select to authenticated
  using (app.is_active() and id in (select org_id from public.profiles where id = auth.uid()));
create policy profile_self_or_admin on public.profiles for select to authenticated
  using (app.is_active() and (id = auth.uid() or app.can_org('manage_users')));
create policy grants_self_or_admin on public.user_role_grants for select to authenticated
  using (app.is_active() and (user_id = auth.uid() or app.can_org('manage_users')));

-- Grant management: managers only, never on yourself, and only an owner can create owner_admin.
grant insert, update on public.user_role_grants to authenticated;
create policy grants_insert on public.user_role_grants for insert to authenticated
  with check (app.can_org('manage_users') and user_id <> auth.uid() and (role <> 'owner_admin' or app.is_owner()));
create policy grants_update on public.user_role_grants for update to authenticated
  using (app.can_org('manage_users') and user_id <> auth.uid())
  with check (app.can_org('manage_users') and user_id <> auth.uid() and (role <> 'owner_admin' or app.is_owner()));

-- Deactivation: managers may set profiles.active, never for themselves.
grant update (active) on public.profiles to authenticated;
create policy profile_deactivate on public.profiles for update to authenticated
  using (app.can_org('manage_users') and id <> auth.uid())
  with check (app.can_org('manage_users') and id <> auth.uid());

-- ---- operations ----
grant select on public.properties, public.legal_entities, public.property_period_metrics, public.operating_plans,
  public.plan_milestones, public.renewal_events, public.pm_assignments, public.pm_scorecards to authenticated;

create policy prop_read on public.properties for select to authenticated using (
  app.can_row('view_company_summary','property',id,department,id,null,entity_id)
  or app.can_row('view_property_financials','property',id,department,id,null,entity_id));
create policy ent_read on public.legal_entities for select to authenticated using (
  app.can_row('view_property_financials','legal_entity',id,department,null,null,id));

-- Financial tables need the financial permission specifically, not just a summary view.
do $$
declare t text;
begin
  foreach t in array array['property_period_metrics','operating_plans','plan_milestones','renewal_events','pm_assignments','pm_scorecards'] loop
    execute format($f$create policy %I on public.%I for select to authenticated using (
      exists (select 1 from public.properties p where p.id = %I.property_id
        and app.can_row('view_property_financials','property',p.id,p.department,p.id,null,p.entity_id)))$f$,
      t || '_read', t, t);
  end loop;
end $$;

-- ---- acquisitions ----
grant select on public.deals, public.deal_assets to authenticated;
create policy deal_read on public.deals for select to authenticated using (
  app.can_row('view_company_summary','deal',id,department,null,id,null)
  or app.can_row('view_deal_financials','deal',id,department,null,id,null));
create policy deal_asset_read on public.deal_assets for select to authenticated using (
  exists (select 1 from public.deals d where d.id = deal_assets.deal_id
    and app.can_row('view_deal_financials','deal',d.id,d.department,null,d.id,null)));

-- Least-privilege view: money fields are null unless the caller has view_deal_financials. Runs as the caller, so RLS applies.
create view public.deals_safe with (security_invoker = true) as
select id, org_id, name, department, kind, stage, state, city, lots, decision, utility, owner, dd_deadline, links,
  case when app.can_row('view_deal_financials','deal',id,department,null,id,null) then asking_price end as asking_price,
  case when app.can_row('view_deal_financials','deal',id,department,null,id,null) then loi_price end as loi_price,
  case when app.can_row('view_deal_financials','deal',id,department,null,id,null) then noi end as noi
from public.deals;
revoke all on public.deals_safe from anon;
grant select on public.deals_safe to authenticated;

-- ---- investor relations (restricted) ----
grant select on public.investor_relationships, public.investor_commitments to authenticated;
create policy inv_read on public.investor_relationships for select to authenticated using (
  app.can_row('view_investor_pii','investor',id,department,null,null,null));
create policy commit_read on public.investor_commitments for select to authenticated using (
  app.can_row('view_investor_pii','investor',investor_id,department,null,null,null));

-- ---- exceptions: visible when the user can see the underlying record ----
grant select on public.operating_exceptions to authenticated;
create policy exc_read on public.operating_exceptions for select to authenticated using (
  app.can_row('view_company_summary', case when deal_id is not null then 'deal' when property_id is not null then 'property' else 'org' end,
    coalesce(deal_id, property_id, id), department, property_id, deal_id, null)
  or app.can_row('view_property_financials','property', coalesce(property_id, id), department, property_id, null, null)
  or app.can_row('view_deal_financials','deal', coalesce(deal_id, id), department, null, deal_id, null)
  or (department = 'ir' and app.can_row('view_investor_pii','investor',id,'ir',null,null,null)));

-- ---- platform tables ----
grant select on public.integrations, public.sync_runs, public.source_records, public.entity_links to authenticated;
create policy integ_read on public.integrations for select to authenticated using (app.can_org('manage_integrations'));
create policy sync_read on public.sync_runs for select to authenticated using (app.can_org('manage_integrations'));
create policy srcrec_read on public.source_records for select to authenticated using (
  internal_id is null and app.can_org('manage_integrations')
  or exists (select 1 from public.deals d where d.id = source_records.internal_id
       and app.can_row('view_company_summary','deal',d.id,d.department,null,d.id,null)));
create policy links_read on public.entity_links for select to authenticated using (app.can_org('manage_integrations'));
grant select on public.resource_scopes to authenticated;
create policy scopes_admin on public.resource_scopes for select to authenticated using (app.can_org('manage_integrations'));

grant select on public.ai_requests to authenticated;
create policy ai_own_or_admin on public.ai_requests for select to authenticated using (user_id = auth.uid() or app.can_org('manage_ai'));
grant select on public.audit_events to authenticated;
create policy audit_admin on public.audit_events for select to authenticated using (app.can_org('manage_users'));

-- Writes to everything else (metrics, deals, investors, sync output, audit) happen only through server-side
-- ingestion with the service key. There is no insert, update, or delete policy for ordinary users.
