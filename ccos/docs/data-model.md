# Data model

Source of truth: `supabase/migrations/0001_schema.sql` and `0002_rls.sql`.

```mermaid
erDiagram
  organizations ||--o{ profiles : has
  profiles ||--o{ user_role_grants : holds
  roles ||--o{ role_permissions : bundles
  permissions ||--o{ role_permissions : in
  roles ||--o| role_home_department : bound_to
  organizations ||--o{ properties : owns
  legal_entities ||--o{ properties : holds
  properties ||--o{ property_period_metrics : measured_by
  properties ||--o{ operating_plans : planned_by
  properties ||--o{ plan_milestones : has
  properties ||--o{ renewal_events : has
  properties ||--o{ pm_assignments : managed_by
  properties ||--o{ pm_scorecards : graded_by
  organizations ||--o{ deals : tracks
  deals ||--o{ deal_assets : contains
  organizations ||--o{ investor_relationships : knows
  investor_relationships ||--o{ investor_commitments : makes
  deals ||--o{ investor_commitments : funds
  properties ||--o{ operating_exceptions : raises
  deals ||--o{ operating_exceptions : raises
  integrations ||--o{ sync_runs : runs
  source_records ||--o| entity_links : linked_by
  profiles ||--o{ ai_requests : asks
```

## Table groups and who can read them

| Group | Tables | Read rule (RLS) |
|---|---|---|
| Reference | roles, permissions, role_permissions | Any active user |
| Identity | profiles, user_role_grants, organizations | Self, or `manage_users` |
| Operations summary | properties, legal_entities | `view_company_summary` or `view_property_financials` in scope |
| Operations financial | property_period_metrics, operating_plans, plan_milestones, renewal_events, pm_assignments, pm_scorecards | `view_property_financials` in scope |
| Acquisitions | deals, deal_assets, `deals_safe` view | Summary in scope. Money fields only with `view_deal_financials` |
| Investor relations | investor_relationships, investor_commitments | `view_investor_pii` in scope |
| Exceptions | operating_exceptions | Visible when the underlying record is visible |
| Platform | integrations, sync_runs, source_records, entity_links, resource_scopes | `manage_integrations` (deal-linked source records follow deal scope) |
| Governance | ai_requests, audit_events | Own AI rows or `manage_ai`. Audit needs `manage_users` |

## Not modeled (on purpose)
No task table (Asana is canonical, tasks are cached read-only). No tenant ledger, KYC, bank, or tax identifiers.

## Writes
Ordinary users cannot insert, update, or delete anything except grants and deactivation (managers only, never on themselves, only an owner can create `owner_admin`). Ingestion and audit writes use the server-only service key.
