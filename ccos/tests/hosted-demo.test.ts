import { afterEach, describe, expect, it } from "vitest";
import { hostedDemoEnabled, liveSourcesConfigured, mockAuthAllowed } from "@/lib/auth";

const KEYS = ["NODE_ENV", "CCOS_MODE", "CCOS_DEMO_HOSTED", "ASANA_ACCESS_TOKEN", "RENTMANAGER_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "POSTGRES_URL", "OPENAI_API_KEY"];
const saved: Record<string, string | undefined> = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const env = process.env as Record<string, string | undefined>;
function set(vars: Record<string, string | undefined>) {
  for (const k of KEYS) delete env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) env[k] = v;
}
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete env[k]; else env[k] = saved[k]; } });

describe("mock sign-in guard", () => {
  it("is allowed in development and test", () => {
    set({ NODE_ENV: "development" });
    expect(mockAuthAllowed()).toBe(true);
    set({ NODE_ENV: "test" });
    expect(mockAuthAllowed()).toBe(true);
  });
  it("is refused in production by default", () => {
    set({ NODE_ENV: "production" });
    expect(mockAuthAllowed()).toBe(false);
  });
  it("is allowed in production only with the explicit hosted demo flag", () => {
    set({ NODE_ENV: "production", CCOS_DEMO_HOSTED: "true" });
    expect(hostedDemoEnabled()).toBe(true);
    expect(mockAuthAllowed()).toBe(true);
    set({ NODE_ENV: "production", CCOS_DEMO_HOSTED: "yes" });
    expect(mockAuthAllowed()).toBe(false);
  });
  it("switches itself off when live mode is set", () => {
    set({ NODE_ENV: "production", CCOS_DEMO_HOSTED: "true", CCOS_MODE: "live" });
    expect(mockAuthAllowed()).toBe(false);
    set({ NODE_ENV: "development", CCOS_MODE: "live" });
    expect(mockAuthAllowed()).toBe(false);
  });
  it("switches itself off when any live source or vendor key is configured", () => {
    for (const k of ["ASANA_ACCESS_TOKEN", "RENTMANAGER_API_KEY", "OPENAI_API_KEY"]) {
      set({ NODE_ENV: "production", CCOS_DEMO_HOSTED: "true", [k]: "x" });
      expect(liveSourcesConfigured()).toBe(true);
      expect(mockAuthAllowed(), k).toBe(false);
    }
  });
  it("keeps working when only an empty Supabase database is connected", () => {
    set({ NODE_ENV: "production", CCOS_DEMO_HOSTED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "x", POSTGRES_URL: "postgres://x" });
    expect(liveSourcesConfigured()).toBe(false);
    expect(mockAuthAllowed()).toBe(true);
  });
  it("still turns off when a real source is added next to Supabase", () => {
    set({ NODE_ENV: "production", CCOS_DEMO_HOSTED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", RENTMANAGER_API_KEY: "x" });
    expect(mockAuthAllowed()).toBe(false);
  });
});
