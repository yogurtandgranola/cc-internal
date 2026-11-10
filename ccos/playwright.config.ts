import { defineConfig } from "@playwright/test";

const PORT = 3100;
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CCOS_PERSIST: "false", CCOS_MODE: "demo", CCOS_SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-1234" },
  },
});
