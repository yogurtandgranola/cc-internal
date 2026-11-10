-- Synthetic fixture. Fixed UUIDs so tests can impersonate users.
insert into public.organizations (id, name) values ('00000000-0000-0000-0000-0000000000a0', 'Demo Org');
insert into auth.users (id) values
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004'),('00000000-0000-0000-0000-000000000005'),('00000000-0000-0000-0000-000000000006'),
 ('00000000-0000-0000-0000-000000000007');
insert into public.profiles (id, org_id, email, name) select u.id, '00000000-0000-0000-0000-0000000000a0', e.email, e.email
 from (values ('00000000-0000-0000-0000-000000000001'::uuid,'founder@demo.example'),('00000000-0000-0000-0000-000000000002','ops@demo.example'),
   ('00000000-0000-0000-0000-000000000003','ir@demo.example'),('00000000-0000-0000-0000-000000000004','pm@demo.example'),
   ('00000000-0000-0000-0000-000000000005','acq@demo.example'),('00000000-0000-0000-0000-000000000006','va@demo.example'),
   ('00000000-0000-0000-0000-000000000007','nogrants@demo.example')) e(id,email) join auth.users u on u.id = e.id;
insert into public.user_role_grants (user_id, role, scope_type, scope_id) values
 ('00000000-0000-0000-0000-000000000001','owner_admin','org',null),
 ('00000000-0000-0000-0000-000000000002','ops_staff','department','operations'),
 ('00000000-0000-0000-0000-000000000003','ir_staff','department','ir'),
 ('00000000-0000-0000-0000-000000000004','external_pm','property','p-cedar'),
 ('00000000-0000-0000-0000-000000000005','acquisitions_staff','department','acquisitions'),
 ('00000000-0000-0000-0000-000000000006','external_contractor','property','p-cedar');
insert into public.legal_entities (id, org_id, name) values ('e-cedar','00000000-0000-0000-0000-0000000000a0','Cedar LLC'),('e-river','00000000-0000-0000-0000-0000000000a0','River LLC');
insert into public.properties (id, org_id, name, entity_id) values
 ('p-cedar','00000000-0000-0000-0000-0000000000a0','Demo Cedar Park','e-cedar'),
 ('p-river','00000000-0000-0000-0000-0000000000a0','Demo River Estates','e-river'),
 ('p-willow','00000000-0000-0000-0000-0000000000a0','Demo Willow Bend',null);
insert into public.property_period_metrics (property_id, month, occupied_sites, rentable_sites, charges_due, payments_allocated, income, expense, source, as_of) values
 ('p-cedar','2026-10-01',110,120,57000,55000,58000,24000,'fixture',now()),('p-river','2026-10-01',64,74,31000,28500,31500,17000,'fixture',now());
insert into public.deals (id, org_id, name, kind, stage, asking_price, noi) values
 ('d-oak','00000000-0000-0000-0000-0000000000a0','Demo Oak Ridge','asset','LOI',3900000,288000),
 ('d-maple','00000000-0000-0000-0000-0000000000a0','Demo Maple Grove','asset','Contract',5200000,372000);
insert into public.investor_relationships (id, org_id, name, contact_email) values
 ('i-a','00000000-0000-0000-0000-0000000000a0','Demo Investor A','investor-a@demo.example'),('i-b','00000000-0000-0000-0000-0000000000a0','Demo Investor B','investor-b@demo.example');
insert into public.investor_commitments (investor_id, kind, amount, source, as_of) values ('i-a','signed',250000,'fixture',now()),('i-b','soft',150000,'fixture',now());
insert into public.operating_exceptions (id, org_id, department, property_id, severity, title) values
 ('x1','00000000-0000-0000-0000-0000000000a0','operations','p-river','high','River collections'),
 ('x2','00000000-0000-0000-0000-0000000000a0','operations','p-cedar','low','Cedar note');
insert into public.audit_events (actor, action, ok) values ('system','seed',true);
insert into public.integrations (id, kind, mode) values ('asana','asana','fixture');
