-- Uploaded weekly reports store a delinquent balance too, and Spring Brook joins the property list.
alter table public.property_period_metrics add column if not exists delinquent_balance numeric(14,2);
insert into public.properties (id, org_id, name)
  select 'spring-brook', o.id, 'Spring Brook' from public.organizations o order by o.created_at limit 1
  on conflict (id) do nothing;
