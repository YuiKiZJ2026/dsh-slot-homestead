import { expect, test, type Page } from "@playwright/test";

test("work rewards fund one lever pull, then the player places the stored collectible", async ({ page }) => {
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
  await page.getByRole("button", { name: "打开收藏盒" }).click();
  await page.getByRole("gridcell", { name: "小盆栽，仓库中，可拖到桌面" }).dragTo(
    page.getByTestId("table-drop-surface"),
    { targetPosition: { x: 53, y: 196 } },
  );
  await expect(page.getByTestId("displayed-plant")).toHaveCount(1);
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
