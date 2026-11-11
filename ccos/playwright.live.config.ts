// Browser test of real sign-in and the People and access screen, against a local Postgres and a stand-in for Supabase Auth.
// Run with: npm run test:e2e:live  (it starts the database for you)
import { defineConfig } from "@playwright/test";

const PORT = 3200;
const DB = process.env.LIVE_E2E_DB_URL ?? "";
export default defineConfig({
  testDir: "./e2e-live",
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
  webServer: [
    { command: "node tests/live-e2e/fake-supabase.mjs", port: 54399, reuseExistingServer: false, timeout: 30_000, env: { LIVE_E2E_DB_URL: DB } },
    {
      command: `npx next dev -p ${PORT}`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        CCOS_PERSIST: "false", CCOS_MODE: "demo", CCOS_SESSION_SECRET: "live-e2e-secret-live-e2e-secret-12345",
        POSTGRES_URL: DB, SUPABASE_URL: "http://localhost:54399", SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SERVICE_ROLE_KEY: "service-key",
        CCOS_OWNER_EMAIL: "owner@cornell.test",
      },
    },
  ],
});
