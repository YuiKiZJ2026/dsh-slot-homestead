import { expect, test, type Page } from "@playwright/test";

test("work rewards fund one lever pull, then the result card places the new collectible", async ({ page }) => {
  await page.goto("/");
  await waitForCanvasReady(page);
  await expect(page.getByTestId("wallet-count")).toHaveText("3");
  await page.getByRole("button", { name: "打开演示控制台" }).click();
  await page.getByRole("button", { name: "完成一个任务" }).click();
  await page.getByRole("button", { name: "增加 60 分钟有效专注" }).click();
  await expect(page.getByTestId("wallet-count")).toHaveText("6");
  await page.getByLabel("预设下次结果").selectOption("common");
  await page.getByRole("button", { name: "拉下右侧摇杆" }).click();
  await expect(page.getByTestId("wallet-count")).toHaveText("5");
  await expect(page.getByTestId("displayed-plant")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "开奖结果" })).toContainText("首次发现");
  await page.getByRole("button", { name: "把 小盆栽 摆上桌面" }).click();
  await expect(page.getByTestId("displayed-plant")).toHaveCount(1);
  await page.getByRole("button", { name: "打开老虎机工具抽屉" }).click();
  await page.getByRole("button", { name: "打开收藏盒" }).click();
  await expect(page.getByRole("gridcell", { name: "小盆栽，桌面上，可拖动" })).toBeVisible();
  await page.reload();
  await waitForCanvasReady(page);
  await expect(page.getByTestId("wallet-count")).toHaveText("5");
  await expect(page.getByTestId("displayed-plant")).toHaveCount(1);
});

async function waitForCanvasReady(page: Page): Promise<void> {
  await expect(page.locator("canvas[data-render-state]"))
    .toHaveAttribute("data-render-state", "ready");
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}
