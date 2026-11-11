// Applies the migrations to a database and exits. Used to prepare a fresh database for the admin integration test.
import pg from "pg";
import { runMigrations } from "../../scripts/migrate.mjs";
import { pgConfig } from "../../lib/pg-config.ts";
const c = new pg.Client(pgConfig(process.argv[2]));
await c.connect();
await runMigrations(c, undefined, () => {});
await c.end();
