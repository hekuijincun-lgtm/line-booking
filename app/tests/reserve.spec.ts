import { test, expect } from "@playwright/test";
test("予約フロー", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[type="date"]', "2025-11-20");
  await page.click("text=空き枠を表示");
  await expect(page).toHaveTitle(/予約/);
});
