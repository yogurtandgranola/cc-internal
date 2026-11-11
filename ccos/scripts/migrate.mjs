// Applies supabase/migrations/*.sql and the generated role seed to the database, once each, in order.
// Runs at the start of a production build on Vercel. It never runs for preview builds, so an unmerged change cannot touch the real database.
// Usage: node scripts/migrate.mjs   (reads POSTGRES_URL_NON_POOLING, only when VERCEL_ENV=production)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pgConfig } from "../lib/pg-config.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function runMigrations(client, dir = path.join(root, "supabase"), log = console.log) {
  await client.query(`create table if not exists public.ccos_migrations (name text primary key, applied_at timestamptz not null default now())`);
  await client.query(`alter table public.ccos_migrations enable row level security`); // no policy: only the owner role can read it
  const files = fs.readdirSync(path.join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const f of files) {
    const done = await client.query("select 1 from public.ccos_migrations where name = $1", [f]);
    if (done.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, "migrations", f), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.ccos_migrations (name) values ($1)", [f]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw new Error(`Migration ${f} failed: ${e.message}`);
    }
    log(`applied ${f}`);
    applied++;
  }
  // The role seed is re-applied every time, in one transaction, so a permission removed in code really disappears.
  const seed = fs.readFileSync(path.join(dir, "seed_roles.sql"), "utf8");
  await client.query("begin");
  try {
    await client.query("delete from public.role_permissions");
    await client.query("delete from public.role_home_department");
    await client.query(seed);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw new Error(`Role seed failed: ${e.message}`);
  }
  log(applied ? `migrations done (${applied} new), roles refreshed` : "migrations already up to date, roles refreshed");
  return applied;
}

async function main() {
  if (process.env.VERCEL_ENV !== "production") { console.log("migrate: skipped (not a production build)"); return; }
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) { console.log("migrate: skipped (no database configured)"); return; }
  const client = new pg.Client(pgConfig(url));
  await client.connect();
  try { await runMigrations(client); } finally { await client.end(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
