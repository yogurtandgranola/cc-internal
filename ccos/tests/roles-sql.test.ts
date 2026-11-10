import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, ROLES } from "@/lib/roles";

describe("SQL role seed", () => {
  it("is in sync with lib/roles.ts (run: node scripts/gen-roles.mjs)", async () => {
    // @ts-expect-error plain ESM script without types
    const { build } = await import("../scripts/gen-roles.mjs");
    const committed = fs.readFileSync(path.join(process.cwd(), "supabase/seed_roles.sql"), "utf8");
    expect(committed).toBe(build());
  });
  it("only the owner holds user and integration management", () => {
    for (const r of ROLES) {
      if (r === "owner_admin") continue;
      expect(ROLE_PERMISSIONS[r]).not.toContain("manage_users");
      expect(ROLE_PERMISSIONS[r]).not.toContain("manage_integrations");
      expect(ROLE_PERMISSIONS[r]).not.toContain("view_executive");
    }
  });
  it("investor PII is limited to owner and IR roles", () => {
    const holders = ROLES.filter((r) => ROLE_PERMISSIONS[r].includes("view_investor_pii"));
    expect(holders.sort()).toEqual(["ir_manager", "ir_staff", "owner_admin"]);
  });
});
