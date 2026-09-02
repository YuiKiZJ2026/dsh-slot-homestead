import { expect, test, type Page } from "@playwright/test";

declare const process: { platform: string };

test.skip(
  process.platform !== "win32",
  "Windows-only golden baselines; Linux runs functional and QA screenshots only.",
);

test.use({ timezoneId: "Asia/Shanghai" });

for (const viewport of [
  { width: 1440, height: 900, name: "1440x900" },
  { width: 1280, height: 720, name: "1280x720" },
  { width: 1024, height: 768, name: "1024x768" },
]) {
  test(`desktop widget ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date("2026-08-31T22:30:00+08:00"));
    await page.goto("/");
    await waitForCanvasReady(page);
    await expect(
      page.getByRole("application", { name: "老虎机庄园｜桌面像素生态养成" }),
    ).toHaveScreenshot(`desktop-${viewport.name}.png`, {
      animations: "disabled",
    });
  });
}

async function waitForCanvasReady(page: Page): Promise<void> {
  await expect(page.locator("canvas[data-render-state]"))
    .toHaveAttribute("data-render-state", "ready");
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}
