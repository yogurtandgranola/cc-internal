-- Cornell Communities OS schema. Postgres 15+ / Supabase.
-- Every table in public has RLS enabled in 0002_rls.sql. Anonymous access is never granted.

create schema if not exists app;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.roles (id text primary key);
create table public.permissions (id text primary key);
create table public.role_permissions (
  role text not null references public.roles(id),
  permission text not null references public.permissions(id),
  primary key (role, permission)
);
-- Roles that are bound to one department (an ops role never reaches IR records, even with org scope).
create table public.role_home_department (
  role text primary key references public.roles(id),
  department text not null check (department in ('acquisitions','operations','ir','executive'))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  email text not null unique,
  name text not null,
  active boolean not null default true,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.user_role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null references public.roles(id),
  scope_type text not null check (scope_type in ('org','department','property','deal','legal_entity','investor')),
  scope_id text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((scope_type = 'org' and scope_id is null) or (scope_type <> 'org' and scope_id is not null))
);
create index on public.user_role_grants (user_id) where revoked_at is null;

-- Generic resource to scope mapping for resources without their own scope columns (tasks, documents).
create table public.resource_scopes (
  resource_type text not null,
  resource_id text not null,
  department text check (department in ('acquisitions','operations','ir','executive')),
  property_id text,
  deal_id text,
  entity_id text,
  primary key (resource_type, resource_id)
);

create table public.legal_entities (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  name text not null,
  department text not null default 'operations' check (department = 'operations'),
  entity_id text generated always as (id) stored
);

create table public.properties (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  name text not null,
  city text, state text,
  department text not null default 'operations' check (department = 'operations'),
  entity_id text references public.legal_entities(id),
  status text not null default 'owned' check (status in ('owned','sold')),
  licensed_sites integer check (licensed_sites >= 0),
  operational_rentable_sites integer check (operational_rentable_sites >= 0),
  links jsonb not null default '{}'
);

create table public.property_period_metrics (
  property_id text not null references public.properties(id),
  month date not null,
  occupied_sites integer, rentable_sites integer,
  charges_due numeric(14,2), payments_allocated numeric(14,2), prior_recoveries numeric(14,2),
  income numeric(14,2), expense numeric(14,2), move_ins integer, move_outs integer,
  source text not null, source_url text, as_of timestamptz not null,
  primary key (property_id, month),
  check (occupied_sites is null or rentable_sites is null or occupied_sites <= rentable_sites)
);

create table public.operating_plans (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id),
  version text not null, approved_at date not null,
  target_occupancy numeric(5,2), target_ttm_noi numeric(14,2),
  unique (property_id, version)
);
create table public.plan_milestones (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id),
  stage text not null, baseline_date date, forecast_date date, actual_date date, owner text,
  budget numeric(14,2), spent numeric(14,2)
);
create table public.renewal_events (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id),
  type text not null, due_date date, owner text, verified_by text, sop_url text, asana_url text
);
create table public.pm_assignments (
  property_id text not null references public.properties(id),
  pm_name text not null, user_id uuid references public.profiles(id),
  primary key (property_id, pm_name)
);
create table public.pm_scorecards (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id),
  period date not null, collections_pct numeric(6,2), occupancy_pct numeric(6,2), net_move_ins integer,
  unique (property_id, period)
);

create table public.deals (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  name text not null,
  department text not null default 'acquisitions' check (department = 'acquisitions'),
  kind text not null check (kind in ('asset','portfolio')),
  stage text not null, state text, city text, lots integer,
  decision text not null default 'active' check (decision in ('active','pass','discard')),
  asking_price numeric(14,2), loi_price numeric(14,2), noi numeric(14,2),
  utility text not null default 'unknown',
  owner text, dd_deadline date, links jsonb not null default '{}'
);
create table public.deal_assets (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals(id),
  name text not null, lots integer
);

create table public.investor_relationships (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  department text not null default 'ir' check (department = 'ir'),
  name text not null, contact_email text, relationship text, last_touch date, next_touch date
);
create table public.investor_commitments (
  id uuid primary key default gen_random_uuid(),
  investor_id text not null references public.investor_relationships(id),
  department text not null default 'ir' check (department = 'ir'),
  kind text not null check (kind in ('soft','signed','collected')),
  amount numeric(14,2) not null check (amount >= 0),
  deal_id text references public.deals(id), source text not null, as_of timestamptz not null
);

create table public.operating_exceptions (
  id text primary key,
  org_id uuid not null references public.organizations(id),
  department text not null check (department in ('acquisitions','operations','ir','executive')),
  property_id text references public.properties(id),
  deal_id text references public.deals(id),
  severity text not null check (severity in ('high','medium','low')),
  title text not null, value_at_risk numeric(14,2), owner text, next_action text, target_date date, blocker text, evidence_url text, source_task_id text
);

create table public.integrations (
  id text primary key, kind text not null, mode text not null check (mode in ('fixture','live')),
  configured boolean not null default false, status text not null default 'not_configured',
  last_success_at timestamptz, error_category text
);
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id text not null references public.integrations(id),
  started_at timestamptz not null, finished_at timestamptz, ok boolean,
  fetched integer, created integer, updated integer, unchanged integer, checkpoint text, error_category text
);
create table public.source_records (
  source text not null, source_object_type text not null, external_id text not null,
  internal_id text, name text, stage text, url text, project_gid text,
  last_seen_at timestamptz not null, as_of timestamptz not null,
  primary key (source, source_object_type, external_id)
);
create table public.entity_links (
  source text not null, source_object_type text not null, external_id text not null,
  internal_id text not null, review_status text not null check (review_status in ('auto','confirmed')),
  confidence numeric(3,2) not null, reason text,
  primary key (source, source_object_type, external_id),
  foreign key (source, source_object_type, external_id) references public.source_records(source, source_object_type, external_id)
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  at timestamptz not null default now(), provider text not null, question text,
  sources_used integer, prompt_tokens integer, completion_tokens integer, cost_usd numeric(10,4), outcome text not null
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(), actor text not null, action text not null, target text, detail text, ok boolean not null
);
