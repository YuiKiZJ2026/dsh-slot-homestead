import { expect, test } from "@playwright/test";

test("narrow page keeps the workshop readable and lets users inspect real growth frames", async ({ page }) => {
  await page.setViewportSize({ width: 896, height: 985 });
  await page.goto("/native-preview.html");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "打开老虎机工具抽屉" }).click();
  await page.getByRole("button", { name: "打开工坊" }).click();
  const panel = page.getByRole("dialog", { name: "像素工坊" });
  const bounds = (await panel.boundingBox())!;
  expect(bounds.width).toBeGreaterThanOrEqual(320);
  await page.getByRole("button", { name: "居民", exact: true }).click();
  await page.getByRole("button", { name: "查看金鱼成长图鉴" }).click();
  await page.getByRole("button", { name: "成鱼", exact: true }).click();
  await expect(page.getByRole("img", { name: "金鱼：成鱼（外观参考）" })).toHaveAttribute("data-sprite-cell", "0:3");
  await expect(panel).toContainText("不代表当前养成进度");
  await page.screenshot({ path: "artifacts/polish-0907/workshop-narrow.png" });
});

test("plant, reserve, cancel and harvest give confirmed feedback", async ({ page }) => {
  await page.goto("/native-preview.html");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "补满测试资源" }).click();
  await page.getByRole("button", { name: "打开老虎机工具抽屉" }).click();
  await page.getByRole("button", { name: "打开工坊" }).click();
  await page.getByRole("searchbox", { name: "搜索工坊" }).fill("番茄");
  await page.getByRole("button", { name: "购买 番茄种子" }).click();
  await page.getByRole("button", { name: "关闭像素工坊" }).click();
  await page.getByRole("button", { name: "生态快进 6 小时" }).click();
  await page.getByRole("button", { name: "打开庄园手账" }).click();
  await page.getByRole("button", { name: "种植计划", exact: true }).click();
  await page.getByRole("combobox", { name: "田地1种子" }).selectOption("tomato-seed");
  await page.getByRole("button", { name: "播种田地1", exact: true }).click();
  await expect(page.locator('[data-plot-plan="1"]')).toContainText("下一茬：番茄");
  await page.getByRole("button", { name: "撤销田地1下一茬" }).click();
  await expect(page.getByTestId("homestead-feedback")).toContainText("肥料 +1");
  await expect(page.locator(".journal-supply")).toContainText("9");
  await expect(page.locator('[data-plot-plan="1"]')).toContainText("胡萝卜");
  for (let n = 0; n < 3; n++) await page.getByRole("button", { name: "生态快进 6 小时" }).click();
  await page.getByRole("button", { name: "收获菜园成熟作物" }).click();
  await expect(page.getByTestId("homestead-feedback")).toContainText("收获已入账");
  await expect(page.getByRole("button", { name: "收获菜园成熟作物" })).toBeDisabled();
  await page.screenshot({ path: "artifacts/polish-0907/garden-feedback.png" });
});

test("native growth reference stays within the expanded companion", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 496 });
  await page.goto("/native-preview.html?display=companion");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "打开老虎机工具抽屉" }).click();
  await page.getByRole("button", { name: "打开工坊" }).click();
  await page.getByRole("button", { name: "居民", exact: true }).click();
  await page.getByRole("button", { name: "查看小鸡成长图鉴" }).click();
  await page.getByRole("button", { name: "成年", exact: true }).click();
  const picture = page.getByRole("img", { name: "小鸡：成年（外观参考）" });
  await expect(picture).toBeVisible();
  const panel = (await page.getByRole("dialog", { name: "像素工坊" }).boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(560);
  expect(panel.y + panel.height).toBeLessThanOrEqual(496);
  await page.screenshot({ path: "artifacts/polish-0907/native-growth.png" });
});

test("reduced motion disables new feedback animation without hiding messages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/native-preview.html");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "打开鱼缸养成抽屉" }).click();
  await page.getByRole("button", { name: "投喂鱼缸" }).click();
  const feedback = page.getByTestId("homestead-feedback");
  await expect(feedback).toContainText("鱼食已投下");
  expect(await feedback.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
});
