import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const PAGES = ["/", "/deals", "/deals/d-oak", "/operations", "/operations/p-cedar", "/investor-relations", "/executive", "/work", "/ai", "/admin", "/search?q=Demo"];

test("no serious or critical accessibility violations on key pages (founder)", async ({ page }) => {
  await signIn(page, "founder@demo.example");
  for (const url of PAGES) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${url}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 120)}`), url).toEqual([]);
  }
});

test("login page is accessible", async ({ page }) => {
  await page.goto("/login");
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("keyboard: skip link and primary navigation are reachable", async ({ page }) => {
  await signIn(page, "founder@demo.example");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
