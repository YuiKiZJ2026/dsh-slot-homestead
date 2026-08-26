import { expect, test, type Page } from "@playwright/test";

test("work rewards fund a spin that displays a collectible", async ({ page }) => {
  await page.goto("/");
  await waitForCanvasReady(page);
  await expect(page.getByTestId("wallet-count")).toHaveText("3");
  await page.getByRole("button", { name: "打开演示控制台" }).click();
  await page.getByRole("button", { name: "完成一个任务" }).click();
  await page.getByRole("button", { name: "增加 60 分钟有效专注" }).click();
  await expect(page.getByTestId("wallet-count")).toHaveText("6");
  await page.getByLabel("预设下次结果").selectOption("common");
  await page.getByRole("button", { name: "投入 1 枚硬币" }).click();
  await page.getByRole("button", { name: "拉动老虎机摇杆" }).click();
  await expect(page.getByTestId("displayed-plant")).toBeVisible();
  await page.reload();
  await waitForCanvasReady(page);
  await expect(page.getByTestId("wallet-count")).toHaveText("5");
  await expect(page.getByTestId("displayed-plant")).toBeVisible();
});

async function waitForCanvasReady(page: Page): Promise<void> {
  await expect(page.locator("canvas[data-render-state]"))
    .toHaveAttribute("data-render-state", "ready");
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}
