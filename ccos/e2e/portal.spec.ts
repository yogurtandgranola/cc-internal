import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("anonymous visitors are sent to login, APIs answer 401 with no data", async ({ page, request }) => {
  await page.goto("/operations");
  await expect(page).toHaveURL(/\/login/);
  for (const url of ["/api/properties", "/api/properties/p-cedar", "/api/investors", "/api/deals", "/api/search?q=Demo", "/api/export/properties"]) {
    const r = await request.get(url);
    expect(r.status(), url).toBe(401);
    expect(await r.text()).not.toMatch(/Demo Cedar|Investor|p-cedar/);
  }
});

test("founder reaches all four areas, admin and audit history, with the DEMO banner", async ({ page }) => {
  await signIn(page, "founder@demo.example");
  await expect(page.getByTestId("demo-banner")).toContainText("DEMO DATA");
  for (const [name, heading] of [["Deals", "Deals"], ["Operations", "Operations"], ["Investor Relations", "Investor Relations"], ["Executive", "Executive briefing"], ["Admin", "Admin"]] as const) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await expect(page.getByTestId("audit-table")).toContainText("login.success");
});

test("ops staff sees properties but is blocked from investor data by URL, API, search, export and AI", async ({ page, request }) => {
  await signIn(page, "opsstaff@demo.example");
  await expect(page.getByRole("link", { name: "Investor Relations" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  const res = await page.goto("/investor-relations");
  expect(res?.status()).toBe(403);
  await expect(page.getByText("You do not have access to this page")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Demo Investor");
  expect((await page.request.get("/api/investors")).status()).toBe(403);
  const s = await page.request.get("/api/search?q=Investor");
  expect((await s.json()).hits).toEqual([]);
  expect((await page.goto("/admin"))?.status()).toBe(403);
  expect((await page.goto("/executive"))?.status()).toBe(403);
  await page.goto("/ai");
  await page.getByRole("textbox", { name: "Question" }).fill("List every investor and their commitment amounts and emails");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("ai-answer")).toContainText("status:");
  await expect(page.getByTestId("ai-answer")).not.toContainText(/Demo Investor|investor-a@|250,000/);
  void request;
});

test("IR manager cannot reach property or deal records", async ({ page }) => {
  await signIn(page, "ir@demo.example");
  await expect(page.getByRole("heading", { name: "Welcome, Demo IR Manager" })).toBeVisible();
  expect((await page.goto("/operations"))?.status()).toBe(403);
  expect((await page.goto("/deals"))?.status()).toBe(403);
  expect((await page.goto("/operations/p-cedar"))?.status()).toBe(404);
  expect((await page.request.get("/api/properties")).status()).toBe(200);
  expect((await (await page.request.get("/api/properties")).json()).properties).toEqual([]);
});

test("external PM sees only Demo Cedar Park, even when URLs and the assistant are tampered with", async ({ page }) => {
  await signIn(page, "pm@demo.example");
  await page.goto("/operations");
  const rows = page.getByTestId("property-table").locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Demo Cedar Park");
  for (const id of ["p-river", "p-willow"]) expect((await page.goto(`/operations/${id}`))?.status(), id).toBe(404);
  expect((await page.request.get("/api/properties/p-river")).status()).toBe(404);
  expect((await page.request.get("/api/properties/..%2Fp-river")).status()).toBe(404);
  const exp = await (await page.request.get("/api/export/properties")).text();
  expect(exp).toContain("Demo Cedar Park");
  expect(exp).not.toMatch(/River|Willow/);
  await page.goto("/ai");
  await page.getByRole("textbox", { name: "Question" }).fill("Tell me about Demo River Estates collections and who owns the next step");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("ai-answer")).toContainText("status:");
  await expect(page.getByTestId("ai-answer")).not.toContainText("River");
});

test("missing metrics read Unavailable, never zero", async ({ page }) => {
  await signIn(page, "ops@demo.example");
  await page.goto("/operations/p-willow");
  await expect(page.getByTestId("stat-physical_occupancy")).toContainText("Unavailable");
  await expect(page.getByTestId("stat-ttm_noi")).toContainText("Unavailable");
  await expect(page.getByTestId("stat-ttm_noi")).not.toContainText("$0");
});

test("deals: filters, board view, drilldown, and dedupe after sync", async ({ page }) => {
  await signIn(page, "acq@demo.example");
  await page.goto("/deals");
  await expect(page.getByTestId("deal-table")).toContainText("Demo Oak Ridge MHC");
  await page.getByLabel("State").selectOption("TN");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByTestId("deal-table")).toContainText("Demo Pine Hollow MHP");
  await expect(page.getByTestId("deal-table")).not.toContainText("Demo Oak Ridge MHC");
  await page.getByRole("link", { name: "Clear" }).click();
  await page.getByRole("link", { name: "Board" }).click();
  await expect(page.getByTestId("deal-board")).toContainText("Demo Maple Grove");
  await page.getByRole("link", { name: "Demo Maple Grove" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Demo Maple Grove" })).toBeVisible();
  await expect(page.getByText("Estoppels outstanding")).toBeVisible();
});

test("admin: invite an external VA from a Gmail address, accept, then deactivate and lock out the old session", async ({ page, browser }) => {
  await signIn(page, "founder@demo.example");
  await page.goto("/admin");
  await page.getByLabel("Any approved email").fill("va.helper@gmail.com");
  await page.getByLabel("Role").selectOption("external_contractor");
  await page.getByLabel("Scope", { exact: true }).selectOption("property");
  await page.getByLabel(/Scope id/).fill("p-cedar");
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = (await page.getByTestId("invite-link").locator("code").textContent())!.replace(/^\/invite/, "/invite");

  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  const va = await ctx.newPage();
  await va.goto(link);
  await va.getByLabel("Your name").fill("Virtual Assistant");
  await va.getByLabel("Password").fill("a-long-passphrase-1");
  await va.getByRole("button", { name: "Create account" }).click();
  await expect(va.getByTestId("whoami")).toContainText("Virtual Assistant");
  expect((await va.request.get("/api/investors")).status()).toBe(403);
  expect((await va.goto("/admin"))?.status()).toBe(403);
  expect((await va.request.get("/api/properties/p-river")).status()).toBe(404);

  await page.goto("/admin");
  await page.getByRole("button", { name: "Deactivate va.helper@gmail.com" }).click();
  await expect(page.getByTestId("user-table")).toContainText("deactivated");
  expect((await va.request.get("/api/properties")).status()).toBe(401);
  await va.goto("/operations");
  await expect(va).toHaveURL(/\/login/);
  await ctx.close();
});

test("unauthorized actions are rejected server-side, not just hidden", async ({ page }) => {
  await signIn(page, "ops@demo.example");
  const r = await page.request.post("/api/ai", { data: { question: "send an email to the tenant about rent" } });
  expect(r.status()).toBe(200);
  expect((await r.json()).status).toBe("refused");
  expect((await page.goto("/admin"))?.status()).toBe(403);
});

test("AI: sourced answer for founder, switch off and dashboards still work", async ({ page }) => {
  await signIn(page, "founder@demo.example");
  await page.goto("/ai");
  await page.getByRole("textbox", { name: "Question" }).fill("Which parks are below 95% collections, and who owns the next step?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("ai-answer")).toContainText("Sources");
  await expect(page.getByTestId("ai-answer")).toContainText("as of");
  await page.goto("/admin");
  await page.getByLabel("Assistant enabled").uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.goto("/ai");
  await expect(page.getByText("Turned off by admin")).toBeVisible();
  await page.goto("/operations");
  await expect(page.getByTestId("property-table")).toContainText("Demo Cedar Park");
});

test("connector sync is idempotent and unresolved matches wait for a person", async ({ page }) => {
  await signIn(page, "founder@demo.example");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Run Asana fixture sync" }).click();
  await expect(page.getByText(/5 source records/)).toBeVisible();
  await page.getByRole("button", { name: "Run Asana fixture sync" }).click();
  await expect(page.getByText(/5 source records/)).toBeVisible();
  await expect(page.getByTestId("review-item")).toHaveCount(1);
  await page.goto("/deals/d-oak");
  await expect(page.getByText("Linked source records")).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo Oak Ridge MHC" }).first()).toBeVisible();
  await signOut(page);
});

test("mobile layout has no horizontal overflow on the home page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, "founder@demo.example");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
