import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  groupDrawsByReelWindow,
  type ReelDraw,
} from "../src/plugin/testing/reel-probe";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const VIEWPORTS = [
  { width: 1_280, height: 720, name: "1280x720", captureSpinning: true },
  { width: 1_024, height: 768, name: "1024x768", captureSpinning: false },
] as const;

test.use({ contextOptions: { reducedMotion: "no-preference" } });

for (const viewport of VIEWPORTS) {
  test(`native preview completes a Host-shaped spin at ${viewport.name}`, async ({ page }, testInfo) => {
    const diagnostics: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") {
        diagnostics.push(`console:${message.type()}:${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      diagnostics.push(`pageerror:${error.message}`);
    });

    await installReelDrawProbe(page);
    await page.setViewportSize(viewport);
    await page.goto("/native-preview.html");
    await expect(page).toHaveTitle("DSH 原生插件预览");
    await waitForCanvasReady(page);

    const application = page.getByRole("application", { name: "DSH 桌面老虎机" });
    await expect(application).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await expect(page.getByTestId("wallet-count")).toHaveText("8");
    await expect(page.getByText("Token 能量：1,850 / 3,000")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Token 能量进度" }))
      .toHaveAttribute("aria-valuenow", "1850");
    await expect(page.getByText("今日 Token 奖励：3 / 8")).toBeVisible();

    const coinControl = page.getByRole("button", { name: "投入 1 枚硬币" });
    const leverControl = page.getByRole("button", { name: "拉动老虎机摇杆" });
    await expect(coinControl).toBeEnabled();
    await coinControl.click();
    await expect(page.getByTestId("wallet-count")).toHaveText("7");
    await expect(leverControl).toBeEnabled();
    const probeCursor = await page.evaluate(() => {
      type BrowserReelDraw = { sx: number; dx: number; dy: number; dw: number; dh: number };
      type ProbeWindow = Window & { __dshReelDrawFrames: BrowserReelDraw[][] };
      return (window as unknown as ProbeWindow).__dshReelDrawFrames.length;
    });
    await leverControl.click();

    const spinningFrameHandle = await page.waitForFunction((cursor) => {
      type BrowserReelDraw = { sx: number; dx: number; dy: number; dw: number; dh: number };
      type ProbeWindow = Window & { __dshReelDrawFrames: BrowserReelDraw[][] };
      const frames = (window as unknown as ProbeWindow).__dshReelDrawFrames;
      for (let index = cursor; index < frames.length; index += 1) {
        const frame = frames[index]!;
        if (frame.length === 12) return frame;
      }
      return null;
    }, probeCursor);
    const spinningSources = await spinningFrameHandle.jsonValue();
    expect(spinningSources).not.toBeNull();
    if (spinningSources === null) throw new Error("Canvas probe returned no spinning reel frame");
    expect(spinningSources).toHaveLength(12);
    const reelGroups = groupDrawsByReelWindow(spinningSources as ReelDraw[]);
    for (const reelDraws of [reelGroups.left, reelGroups.center, reelGroups.right]) {
      expect(reelDraws).toHaveLength(4);
      expect(new Set(reelDraws.map(({ sx }) => sx)).size).toBeGreaterThan(1);
      expect(reelDraws.map(({ sx }) => sx)).not.toContain(0);
      expect(reelDraws.every(({ dw, dh }) => dw === 18 && dh === 18)).toBe(true);
    }

    if (viewport.captureSpinning) {
      await captureQaScreenshot(
        page,
        testInfo,
        `native-preview-spinning-${viewport.name}.png`,
      );
    }

    await expect(page.getByTestId("wallet-count")).toHaveText("12");
    await expect(page.locator("#game-status")).toContainText("获得 5 枚硬币");
    await expect(coinControl).toBeEnabled();
    await captureQaScreenshot(
      page,
      testInfo,
      `native-preview-settled-${viewport.name}.png`,
    );

    const widgetBox = await requiredBoundingBox(page.locator(".slot-widget"));
    const hostStatusBox = await requiredBoundingBox(page.locator(".host-status"));
    const launchersBox = await requiredBoundingBox(page.locator(".widget-launchers"));
    for (const box of [widgetBox, hostStatusBox, launchersBox]) {
      expectBoxInsideViewport(box, viewport);
    }
    expect(boxesOverlap(widgetBox, launchersBox)).toBe(false);
    expect(boxesOverlap(widgetBox, hostStatusBox)).toBe(false);
    expect(diagnostics).toEqual([]);
  });
}

async function waitForCanvasReady(page: Page): Promise<void> {
  const canvas = page.locator("canvas[data-render-state]");
  await expect(canvas).toHaveAttribute("data-render-state", "ready");
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}

async function captureQaScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function requiredBoundingBox(locator: Locator): Promise<BoundingBox> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) throw new Error(`Visible surface has no bounding box: ${locator}`);
  return box;
}

function expectBoxInsideViewport(
  box: BoundingBox,
  viewport: { width: number; height: number },
): void {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

function boxesOverlap(first: BoundingBox, second: BoundingBox): boolean {
  return first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
}

async function installReelDrawProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type BrowserReelDraw = { sx: number; dx: number; dy: number; dw: number; dh: number };
    const frames: BrowserReelDraw[][] = [];
    let currentFrame: BrowserReelDraw[] | null = null;
    let gameCanvas: HTMLCanvasElement | null = null;
    Object.defineProperty(window, "__dshReelDrawFrames", {
      configurable: false,
      value: frames,
      writable: false,
    });

    const prototype = CanvasRenderingContext2D.prototype;
    const clearRect = prototype.clearRect;
    const drawImage = prototype.drawImage;
    prototype.clearRect = function (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
    ): void {
      if (
        this.canvas.width === 384 &&
        this.canvas.height === 288 &&
        this.canvas.matches("canvas[data-render-state]") &&
        x === 0 &&
        y === 0 &&
        width === 384 &&
        height === 288
      ) {
        gameCanvas = this.canvas;
        currentFrame = [];
        frames.push(currentFrame);
      }
      Reflect.apply(clearRect, this, [x, y, width, height]);
    };
    prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      image: CanvasImageSource,
      ...args: number[]
    ): void {
      if (
        currentFrame !== null &&
        this.canvas === gameCanvas &&
        image instanceof HTMLImageElement &&
        (image.currentSrc || image.src).includes("reel-symbols-runtime.png") &&
        args.length === 8
      ) {
        currentFrame.push({
          sx: args[0]!,
          dx: args[4]!,
          dy: args[5]!,
          dw: args[6]!,
          dh: args[7]!,
        });
      }
      Reflect.apply(drawImage, this, [image, ...args]);
    } as CanvasRenderingContext2D["drawImage"];
  });
}
