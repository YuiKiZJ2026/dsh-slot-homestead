import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Shanghai" });
test("native companion keeps the journal usable in its compact and expanded sizes", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 384 });
  await page.goto("/native-preview.html?display=companion");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "打开庄园手账" }).click();
  await page.setViewportSize({ width: 560, height: 496 });
  const panel = page.getByRole("dialog", { name: "庄园手账", exact: true });
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "种植计划", exact: true }).click();
  await page.getByRole("button", { name: "播种田地2", exact: true }).click();
  await expect(page.locator('[data-plot-plan="2"]')).toContainText("胡萝卜");
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(561);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(496);
  await page.screenshot({ path: "artifacts/local-upgrade/native-companion.png" });
  await page.getByRole("button", { name: "合上庄园手账" }).click();
  await expect(panel).toHaveCount(0);
});

test("sow, grow, harvest and claim a journal reward through the real page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/native-preview.html");
  await expect(page.locator("canvas[data-render-state]")).toHaveAttribute("data-render-state", "ready");
  await page.getByRole("button", { name: "补满测试资源" }).click();
  await expect(page.getByTestId("wallet-count")).toHaveText("99");
  await page.getByRole("button", { name: "打开庄园手账" }).click();
  const journal = page.getByRole("dialog", { name: "庄园手账", exact: true });
  await expect(journal).toBeVisible();
  const journalBounds = (await journal.boundingBox())!;
  const lightingBounds = (await page.locator(".preview-lighting").boundingBox())!;
  expect(lightingBounds.y + lightingBounds.height).toBeLessThanOrEqual(journalBounds.y);
  await page.getByRole("button", { name: "种植计划", exact: true }).click();
  await page.getByRole("button", { name: "播种田地2", exact: true }).click();
  await expect(page.locator('[data-plot-plan="2"]')).toContainText("胡萝卜");
  await expect(page.getByRole("button", { name: "播种田地2", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "播种田地3", exact: true }).click();
  await page.getByRole("button", { name: "合上庄园手账" }).click();
  await page.getByRole("button", { name: "下一处养成场景" }).click();
  await expect(page.locator('[data-resident-id="carrot-seed"]')).toHaveCount(3);
  for (let index = 0; index < 4; index++) await page.getByRole("button", { name: "生态快进 6 小时" }).click();
  await expect(page.locator('[data-plot="2"]')).toHaveAttribute("data-visual-stage", "harvest-ready");
  await page.getByRole("button", { name: "打开种植园养成抽屉" }).click();
  await page.getByRole("button", { name: "收获", exact: true }).click();
  await expect(page.getByTestId("wallet-count")).toHaveText("108");
  await expect(page.locator('[data-plot="2"]')).toHaveAttribute("data-growth-progress", "0");
  await page.getByRole("button", { name: "打开庄园手账" }).click();
  await page.getByRole("button", { name: "领取今天也有好收成" }).click();
  await expect(page.getByRole("button", { name: "已领取今天也有好收成" })).toBeDisabled();
  await expect(journal).toContainText("15 / 50");
  await page.screenshot({ path: "artifacts/local-upgrade/journal-harvest.png" });
  await page.keyboard.press("Escape");
  await expect(journal).toHaveCount(0);
  await expect(page.getByRole("button", { name: "打开庄园手账" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("night preview, three habitats and searchable workshop remain interactive", async ({ page }) => {
  await page.goto("/native-preview.html");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "夜晚", exact: true }).click();
  await expect(page.getByRole("application")).toHaveAttribute("data-day-phase", "night");
  for (const habitat of ["aquarium", "garden", "animals"]) {
    await expect(page.locator(`.ecosystem-scene__habitat-layer[data-habitat="${habitat}"]`)).toBeVisible();
    await page.screenshot({ path: `artifacts/local-upgrade/night-${habitat}.png` });
    await page.getByRole("button", { name: "下一处养成场景" }).click();
  }
  await page.getByRole("button", { name: "打开老虎机工具抽屉" }).click();
  await page.getByRole("button", { name: "打开工坊" }).click();
  await page.getByRole("searchbox", { name: "搜索工坊" }).fill("番茄");
  await expect(page.getByRole("button", { name: "购买 番茄种子" })).toBeVisible();
  await expect(page.getByRole("button", { name: "购买 垂耳兔" })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "搜索工坊" }).fill("没有这个东西");
  await expect(page.getByText("没有找到，试试「鱼」「种子」或「肥料」。")).toBeVisible();
});
