\set ON_ERROR_STOP on
\set QUIET on

create schema if not exists t;
grant usage on schema t to anon, authenticated;

create or replace function t.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
end $$;

create or replace function t.expect(label text, got bigint, want bigint) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: got % want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;

create or replace function t.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin execute stmt; get diagnostics n = row_count; return n; end $$;

create or replace function t.expect_denied(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when insufficient_privilege or others then
    if sqlerrm ~* 'permission denied|row-level security|violates|must be owner' then raise notice 'ok   % (denied)', label; return; end if;
    raise;
  end;
  raise exception 'FAIL %: statement was allowed', label;
end $$;


grant execute on all functions in schema t to anon, authenticated;

-- 0. structural guarantees
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity);
  if missing is not null then raise exception 'FAIL RLS not enabled and forced on: %', missing; end if;
  raise notice 'ok   RLS enabled and forced on every public table';
  if exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public') then
    raise exception 'FAIL anon has table privileges'; end if;
  raise notice 'ok   anon has no table privileges';
end $$;

begin;
-- 1. founder sees everything, including audit and grants
select t.as_user('00000000-0000-0000-0000-000000000001');
select t.expect('founder properties', (select count(*) from properties), 3);
select t.expect('founder investor commitments', (select count(*) from investor_commitments), 2);
select t.expect('founder deals financial', (select count(*) from deals where asking_price is not null), 2);
select t.expect('founder audit', (select count(*) from audit_events), 1);
select t.expect('founder all grants', (select count(*) from user_role_grants), 6);
rollback;

begin;
-- 2. ops staff: properties and financials yes, investors no, deals no, no tenant-restricted, no audit, own grants only
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.expect('ops properties', (select count(*) from properties), 3);
select t.expect('ops metrics', (select count(*) from property_period_metrics), 2);
select t.expect('ops investors', (select count(*) from investor_relationships), 0);
select t.expect('ops commitments', (select count(*) from investor_commitments), 0);
select t.expect('ops deals', (select count(*) from deals), 0);
select t.expect('ops audit', (select count(*) from audit_events), 0);
select t.expect('ops integrations', (select count(*) from integrations), 0);
select t.expect('ops own grants only', (select count(*) from user_role_grants), 1);
select t.expect('ops exceptions (ops dept only)', (select count(*) from operating_exceptions), 2);
rollback;

begin;
-- 3. IR staff: investors yes, properties and metrics no
select t.as_user('00000000-0000-0000-0000-000000000003');
select t.expect('ir investors', (select count(*) from investor_relationships), 2);
select t.expect('ir commitments', (select count(*) from investor_commitments), 2);
select t.expect('ir properties', (select count(*) from properties), 0);
select t.expect('ir metrics', (select count(*) from property_period_metrics), 0);
select t.expect('ir deals', (select count(*) from deals), 0);
select t.expect('ir exceptions', (select count(*) from operating_exceptions), 0);
rollback;

begin;
-- 4. external PM on one property: exactly that property, and tampering with ids returns nothing
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.expect('pm properties', (select count(*) from properties), 1);
select t.expect('pm sees cedar', (select count(*) from properties where id = 'p-cedar'), 1);
select t.expect('pm forged river id', (select count(*) from properties where id = 'p-river'), 0);
select t.expect('pm metrics own only', (select count(*) from property_period_metrics where property_id = 'p-river'), 0);
select t.expect('pm metrics cedar', (select count(*) from property_period_metrics where property_id = 'p-cedar'), 1);
select t.expect('pm exceptions', (select count(*) from operating_exceptions), 1);
select t.expect('pm legal entities', (select count(*) from legal_entities where id = 'e-river'), 0);
select t.expect('pm investors', (select count(*) from investor_relationships), 0);
rollback;

begin;
-- 5. acquisitions staff: deals visible, but money fields hidden by the safe view
select t.as_user('00000000-0000-0000-0000-000000000005');
select t.expect('acq staff deals', (select count(*) from deals_safe), 2);
select t.expect('acq staff safe view hides prices', (select count(*) from deals_safe where asking_price is not null or noi is not null), 0);
select t.expect('acq staff properties', (select count(*) from properties), 0);
rollback;

begin;
-- 6. external contractor (summary only): sees the property row, not its financials
select t.as_user('00000000-0000-0000-0000-000000000006');
select t.expect('contractor property', (select count(*) from properties), 1);
select t.expect('contractor metrics', (select count(*) from property_period_metrics), 0);
rollback;

begin;
-- 7. a user with no grants sees nothing
select t.as_user('00000000-0000-0000-0000-000000000007');
select t.expect('no grants properties', (select count(*) from properties), 0);
select t.expect('no grants deals', (select count(*) from deals), 0);
select t.expect('no grants investors', (select count(*) from investor_relationships), 0);
rollback;

-- 8. deactivation takes effect on the next query
begin;
update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000002';
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.expect('deactivated ops properties', (select count(*) from properties), 0);
select t.expect('deactivated ops grants', (select count(*) from user_role_grants), 0);
rollback;
-- revoked grant also takes effect
begin;
update public.user_role_grants set revoked_at = now() where user_id = '00000000-0000-0000-0000-000000000004';
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.expect('revoked pm properties', (select count(*) from properties), 0);
rollback;

-- 9. anonymous role is denied outright
begin;
set local role anon;
select t.expect_denied('anon properties', 'select count(*) from public.properties');
select t.expect_denied('anon investors', 'select count(*) from public.investor_commitments');
rollback;

-- 10. writes and privilege escalation
begin;
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.expect_denied('ops insert property', $$insert into public.properties (id, org_id, name) values ('x','00000000-0000-0000-0000-0000000000a0','x')$$);
select t.expect_denied('ops update metric', $$update public.property_period_metrics set income = 1$$);
select t.expect_denied('ops delete deal', $$delete from public.deals$$);
select t.expect_denied('ops self-grant owner', $$insert into public.user_role_grants (user_id, role, scope_type) values ('00000000-0000-0000-0000-000000000002','owner_admin','org')$$);
select t.expect_denied('ops write audit', $$insert into public.audit_events (actor, action, ok) values ('x','x',true)$$);
rollback;

begin;
select t.as_user('00000000-0000-0000-0000-000000000001');
select t.expect('owner cannot edit own grants (0 rows)', t.affected($$update public.user_role_grants set role = 'restricted_viewer' where user_id = '00000000-0000-0000-0000-000000000001'$$), 0);
select t.expect('owner updating own grants affects 0 rows', t.affected($$update public.user_role_grants set revoked_at = now() where user_id = '00000000-0000-0000-0000-000000000001'$$), 0);
select t.expect('owner cannot deactivate self (0 rows)', t.affected($$update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000001'$$), 0);
select t.expect('owner can deactivate others', t.affected($$update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000006'$$), 1);
rollback;

begin;
-- a non-owner manager cannot mint owner_admin even with manage_users
insert into public.roles (id) values ('delegate') on conflict do nothing;
insert into public.role_permissions (role, permission) values ('delegate','manage_users');
insert into public.user_role_grants (user_id, role, scope_type) values ('00000000-0000-0000-0000-000000000007','delegate','org');
select t.as_user('00000000-0000-0000-0000-000000000007');
select t.expect_denied('delegate cannot create owner', $$insert into public.user_role_grants (user_id, role, scope_type) values ('00000000-0000-0000-0000-000000000006','owner_admin','org')$$);
select t.expect('delegate can create a normal grant', t.affected($$insert into public.user_role_grants (user_id, role, scope_type) values ('00000000-0000-0000-0000-000000000006','restricted_viewer','org')$$), 1);
rollback;

\echo ALL RLS TESTS PASSED
