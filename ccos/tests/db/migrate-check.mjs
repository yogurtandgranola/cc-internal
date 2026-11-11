// Runs the migration runner twice against a throwaway database and checks it is safe to repeat.
import assert from "node:assert/strict";
import pg from "pg";
import { runMigrations } from "../../scripts/migrate.mjs";
import { pgConfig } from "../../lib/pg-config.ts";

const client = new pg.Client(pgConfig(process.argv[2]));
await client.connect();
const quiet = () => {};
const first = await runMigrations(client, undefined, quiet);
assert.ok(first >= 2, `first run applies the schema and RLS files, applied ${first}`);
const tables = (await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n;
assert.ok(tables > 15, `schema created (${tables} tables)`);
const roles = (await client.query("select count(*)::int n from public.roles")).rows[0].n;
assert.ok(roles >= 10, "roles seeded");

assert.equal(await runMigrations(client, undefined, quiet), 0, "second run applies nothing");

// A permission that is not in code must disappear on the next run.
await client.query("insert into public.permissions (id) values ('bogus') on conflict do nothing");
await client.query("insert into public.role_permissions (role, permission) values ('restricted_viewer','bogus')");
await runMigrations(client, undefined, quiet);
const stale = (await client.query("select count(*)::int n from public.role_permissions where permission='bogus'")).rows[0].n;
assert.equal(stale, 0, "stale permission removed");

// RLS stays on for the tracking table.
const rls = (await client.query("select relrowsecurity r from pg_class where oid = 'public.ccos_migrations'::regclass")).rows[0].r;
assert.equal(rls, true);
await client.end();
console.log("migrate check: ok (" + first + " files applied, repeat run is a no-op, stale permission removed)");
