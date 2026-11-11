import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const OWNER = "owner@cornell.test";
const OWNER_PW = "owner-password-123";
const CHELSEA = "chelsea@cornell.test";

async function attemptSignIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
// Waits until the sign-in has finished and the cookie is set.
async function signIn(page: Page, email: string, password: string) {
  await attemptSignIn(page, email, password);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}
async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}
const row = (page: Page, email: string) => page.getByTestId("people-table").getByRole("row").filter({ hasText: email });
// The list of access a person holds, not the checkbox list inside "Give more access".
const access = (page: Page, email: string) => row(page, email).locator("td").nth(1).locator("ul").first();

test.describe.serial("real sign-in and People and access", () => {
  let temp = "";
  const newPassword = "chelseas-own-password-1";

  test("the owner signs in for the first time and is made owner", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await expect(page.getByTestId("whoami")).toContainText("owner_admin");
    await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People and access" })).toBeVisible();
  });

  test("a wrong password and a stranger are refused", async ({ page }) => {
    await attemptSignIn(page, OWNER, "not-the-password");
    await expect(page.locator('p[role="alert"]')).toContainText("incorrect");
    await attemptSignIn(page, "stranger@cornell.test", "whatever-password-1");
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    expect((await page.goto("/admin"))?.status()).toBeLessThan(400); // redirected to login, no data
    await expect(page).toHaveURL(/\/login/);
  });

  test("the owner adds ops staff limited to two properties", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "People and access" })).toBeVisible();
    await page.locator("#np-name").fill("Chelsea");
    await page.locator("#np-email").fill(CHELSEA);
    await page.locator("#np-role").selectOption("ops_staff");
    await page.getByLabel("Lincoln Park MH/RV").check();
    await page.getByLabel("Emporia").check();
    await page.getByRole("button", { name: "Add person" }).click();
    const box = page.getByTestId("temp-password");
    await expect(box).toBeVisible();
    temp = (await box.textContent())!.trim();
    expect(temp).toHaveLength(16);
    const a = access(page, CHELSEA);
    await expect(a).toContainText("Operations staff");
    await expect(a).toContainText("Lincoln Park MH/RV");
    await expect(a).toContainText("Emporia");
    await expect(a).not.toContainText("Sunflower");
    await expect(a.getByRole("listitem")).toHaveCount(2);
    await expect(row(page, CHELSEA)).toContainText("Has not chosen their own password yet");
  });

  test("the new person must choose their own password, then sees only what they were given", async ({ page }) => {
    await signIn(page, CHELSEA, temp);
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
    await page.goto("/"); // cannot skip it
    await expect(page).toHaveURL(/\/account/);
    await page.getByLabel("Current password").fill(temp);
    await page.getByLabel("New password (12 or more characters)").fill(newPassword);
    await page.getByLabel("New password again").fill("something-different-1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("do not match");
    await page.getByLabel("Current password").fill(temp);
    await page.getByLabel("New password (12 or more characters)").fill(newPassword);
    await page.getByLabel("New password again").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People and access" })).toHaveCount(0);
    expect((await page.goto("/admin"))?.status()).toBe(403);
    expect((await page.goto("/investor-relations"))?.status()).toBe(403);
    expect((await page.goto("/deals"))?.status()).toBe(403);
    const api = await page.request.get("/api/investors");
    expect(api.status()).toBe(403);
  });

  test("the owner gives more access, removes some, and resets a password", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    const r = row(page, CHELSEA);
    await r.getByText("Give more access").click();
    await r.getByLabel("Sunflower Estates").check();
    await r.getByRole("button", { name: "Give access" }).click();
    await expect(r.getByText("Access added.")).toBeVisible();
    await page.reload();
    await expect(access(page, CHELSEA)).toContainText("Sunflower Estates");
    await expect(access(page, CHELSEA).getByRole("listitem")).toHaveCount(3);
    await row(page, CHELSEA).getByRole("button", { name: /Remove Operations staff access for/ }).first().click();
    await expect(access(page, CHELSEA).getByRole("listitem")).toHaveCount(2);
    await row(page, CHELSEA).getByRole("button", { name: `Reset password for ${CHELSEA}` }).click();
    const t2 = page.getByTestId("temp-password");
    await expect(t2).toBeVisible();
    temp = (await t2.textContent())!.trim();
    expect(temp).not.toBe("");
  });

  test("switching someone off locks them out; switching on brings them back", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    await row(page, CHELSEA).getByRole("button", { name: `Switch off ${CHELSEA}` }).click();
    await page.waitForLoadState("networkidle");
    await expect(row(page, CHELSEA)).toContainText("switched off");
    await signOut(page);
    await attemptSignIn(page, CHELSEA, temp);
    await expect(page.locator('p[role="alert"]')).toContainText("switched off");
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    await row(page, CHELSEA).getByRole("button", { name: `Switch on ${CHELSEA}` }).click();
    await page.waitForLoadState("networkidle");
    await expect(row(page, CHELSEA)).toContainText("active");
    await signOut(page);
    await signIn(page, CHELSEA, temp);
    await expect(page).toHaveURL(/\/account/); // reset forced a new password choice
  });

  test("the owner cannot lock themselves out", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    const mine = row(page, OWNER);
    await expect(mine).toContainText("You");
    await expect(mine.getByRole("button")).toHaveCount(0);
  });

  test("an owner can add a property and it shows up in the pickers", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    await page.locator("#pp-name").fill("Green Valley Estates");
    await page.locator("#pp-city").fill("Hallstead");
    await page.locator("#pp-state").fill("PA");
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(page.getByText("Added Green Valley Estates.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Green Valley Estates").first()).toBeVisible();
    await page.locator("#pp-name").fill("green valley estates");
    await page.getByRole("button", { name: "Add property" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("already exists");
  });

  test("the audit list shows the changes", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    await page.goto("/admin");
    const list = page.getByTestId("audit-list");
    for (const a of ["person.add", "grant.add", "grant.revoke", "person.deactivate", "property.add"]) await expect(list).toContainText(a);
  });

  test("no serious accessibility problems on the new screens", async ({ page }) => {
    await signIn(page, OWNER, OWNER_PW);
    for (const path of ["/admin", "/account"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    }
  });

  test("demo accounts still work next to real ones and see the demo admin", async ({ page }) => {
    await signIn(page, "founder@demo.example", "demo-password");
    await expect(page.getByTestId("whoami")).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
    await expect(page.getByTestId("user-table")).toBeVisible();
  });
});
