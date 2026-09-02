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
import { PLUGIN_STYLE } from "../src/plugin/client/style";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const VIEWPORTS = [
  { width: 1_280, height: 720, name: "1280x720", captureSpinning: true },
  { width: 1_024, height: 768, name: "1024x768", captureSpinning: false },
  { width: 1_024, height: 576, name: "1024x576", captureSpinning: false },
] as const;

const HABITAT_ARTWORK = [
  { id: "aquarium", title: "鱼缸" },
  { id: "garden", title: "种植园" },
  { id: "animals", title: "牧场" },
] as const;

test.use({
  contextOptions: { reducedMotion: "no-preference" },
  timezoneId: "Asia/Shanghai",
});

test("desktop overlay passes transparent table clicks to the DSH control beneath it", async ({ page }) => {
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);
  await page.addStyleTag({ content: PLUGIN_STYLE });
  await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>(".dsh-slot-widget-root");
    if (root === null) throw new Error("slot overlay root is missing");
    root.classList.remove("desktop--page");
    root.classList.add("desktop--overlay");
    root.style.zIndex = "2";
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const canvas = document.querySelector<HTMLElement>(".game-canvas-wrap");
    if (canvas === null) throw new Error("slot canvas is missing");
    const box = canvas.getBoundingClientRect();
    const underlay = document.createElement("button");
    underlay.type = "button";
    underlay.textContent = "DSH 模型按钮";
    underlay.dataset.testid = "dsh-underlay-control";
    Object.assign(underlay.style, {
      position: "fixed",
      left: `${box.left + 320}px`,
      top: `${box.top + 244}px`,
      zIndex: "1",
      width: "56px",
      height: "28px",
    });
    underlay.addEventListener("click", () => { underlay.dataset.clicked = "true"; });
    document.body.prepend(underlay);
  });

  const underlay = page.getByTestId("dsh-underlay-control");
  await underlay.click();
  await expect(underlay).toHaveAttribute("data-clicked", "true");
  await expect(page.getByRole("button", { name: "拉下右侧摇杆" })).toBeEnabled();
});

test("every habitat background is loaded, visible, and opaque on its first switched frame", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const habitatBay = page.locator(".ecosystem-scene__habitat-bay");
  const nextHabitat = page.getByRole("button", { name: "下一处养成场景" });

  for (const [index, habitat] of HABITAT_ARTWORK.entries()) {
    if (index > 0) {
      await nextHabitat.click();
      const firstFrameOpacity = await firstPaintOpacity(
        page.locator(`.ecosystem-scene__habitat-stage[data-habitat="${habitat.id}"]`),
      );
      expect(firstFrameOpacity, `${habitat.title}切换首帧不能透明`).toBeGreaterThan(0);
    }

    await expectHabitatArtworkLoaded(page, habitat.id, habitatBay);
  }
});

test("ecosystem fast-forward shows growth immediately without opening a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.clock.setFixedTime(new Date("2026-09-01T10:00:00+08:00"));
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const ecosystem = page.getByRole("region", { name: "养成生态", exact: true });
  const sandbox = page.getByRole("region", { name: "预览测试沙盒" });
  const goldfish = page.locator('[data-resident-id="goldfish"]');
  await expect(page.getByRole("application", { name: "DSH 桌面老虎机" }))
    .toHaveAttribute("data-day-phase", "day");
  await expect(page.getByRole("region", { name: "鱼缸养成抽屉" })).toHaveCount(0);
  await expect(ecosystem).toContainText(/鱼缸 1 \/ 3.*鱼苗 0%/);
  await expect(goldfish).toHaveAttribute("data-growth-progress", "0");
  await expect(goldfish).toHaveAttribute("data-visual-stage", "fry");
  await expect(goldfish).toHaveAttribute("data-sprite-frame", "0");

  await sandbox.getByRole("button", { name: "生态快进 6 小时" }).click();

  await expect(ecosystem).toContainText(/鱼缸 1 \/ 3.*幼鱼 24%/);
  await expect(goldfish).toHaveAttribute("data-growth-progress", "24");
  await expect(goldfish).toHaveAttribute("data-visual-stage", "juvenile");
  await expect(goldfish).toHaveAttribute("data-sprite-frame", "1");
  await expectSpriteSheetLoaded(goldfish);
  await expectResidentBoxAtLeast(goldfish, 40);
  await expect(sandbox.getByRole("status")).toContainText(/鱼缸 24%.*种植园 30%.*牧场 18%/);

  await page.getByRole("button", { name: "下一处养成场景" }).click();
  await expect(ecosystem).toContainText(/种植园 2 \/ 3.*展叶 30%/);
  await expect(page.locator('[data-resident-id="carrot-seed"]')).toHaveAttribute("data-visual-stage", "leafing");
  await expect(page.locator('[data-resident-id="carrot-seed"]')).toHaveAttribute("data-sprite-frame", "1");
  await expectSpriteSheetLoaded(page.locator('[data-resident-id="carrot-seed"]'));
  await expectResidentBoxAtLeast(page.locator('[data-resident-id="carrot-seed"]'), 38);
  await page.getByRole("button", { name: "下一处养成场景" }).click();
  await expect(ecosystem).toContainText(/牧场 3 \/ 3.*青年 18%/);
  await expect(page.locator('[data-resident-id="chick"]')).toHaveAttribute("data-visual-stage", "young");
  await expect(page.locator('[data-resident-id="chick"]')).toHaveAttribute("data-sprite-frame", "1");
  await expectSpriteSheetLoaded(page.locator('[data-resident-id="chick"]'));
  await expectResidentBoxAtLeast(page.locator('[data-resident-id="chick"]'), 30);
});

test("fish face their travel direction and every lifecycle sprite has readable anatomy", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const swimFrames = await page.locator('[data-resident-id="goldfish"]').evaluate((element) => {
    const animation = element.getAnimations().find(
      (candidate) => (candidate as CSSAnimation).animationName === "dsh-fish-swim-a",
    );
    if (!(animation?.effect instanceof KeyframeEffect)) {
      throw new Error("goldfish swim keyframes are missing");
    }
    return animation.effect.getKeyframes().map((frame) => String(frame.transform));
  });

  expect(swimFrames).toEqual([
    expect.stringMatching(/translate3d\(92px, 0px, 0px\).*scaleX\(-1\)/),
    expect.stringMatching(/translate3d\(0px, 5px, 0px\).*scaleX\(-1\)/),
    expect.stringMatching(/translate3d\(0px, 5px, 0px\).*scaleX\(1\)/),
    expect.stringMatching(/translate3d\(92px, 0px, 0px\).*scaleX\(1\)/),
    expect.stringMatching(/translate3d\(92px, 0px, 0px\).*scaleX\(-1\)/),
  ]);

  const spriteAnatomy = await page.evaluate(async () => {
    const response = await fetch("/assets/ecosystem-fish-lifecycle-atlas-v2.svg");
    const xml = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
    return Array.from(xml.querySelectorAll('g[data-species][data-stage]')).map((stage) => ({
      facing: stage.getAttribute("data-native-facing"),
      roles: ["tail", "dorsal-fin", "pectoral-fin", "gill", "eye", "mouth"].map(
        (role) => stage.querySelector(`[data-role="${role}"]`) !== null,
      ),
    }));
  });

  expect(spriteAnatomy).toHaveLength(12);
  expect(spriteAnatomy.every((stage) => stage.facing === "right" && stage.roles.every(Boolean))).toBe(true);
});

test("every fast-forward click shows a settlement card and explains mature habitats", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const advance = page.getByRole("button", { name: "生态快进 6 小时" });
  const settlement = page.locator(".preview-ecosystem-settlement");
  await expect(settlement).toHaveCount(0);

  await advance.click();
  await expect(settlement).toBeVisible();
  await expect(settlement).toHaveAttribute("data-settlement-sequence", "1");
  await expect(settlement).toContainText("生态结算 +6 小时");
  await expect(settlement).toContainText(/鱼缸.*幼鱼.*24%/);
  await expect(settlement).toContainText(/种植园.*展叶.*30%/);
  await expect(settlement).toContainText(/牧场.*青年.*18%/);

  for (let sequence = 2; sequence <= 6; sequence += 1) {
    await advance.click();
    await expect(settlement).toHaveAttribute("data-settlement-sequence", String(sequence));
  }
  await expect(settlement).toContainText(/鱼缸.*成鱼.*成长完成/);
  await expect(settlement).toContainText(/种植园.*成熟.*可收获/);
  await expect(settlement).toContainText(/牧场.*成年.*生产中.*13%/);

  for (let sequence = 7; sequence <= 9; sequence += 1) {
    await advance.click();
    await expect(settlement).toHaveAttribute("data-settlement-sequence", String(sequence));
  }
  await expect(settlement).toContainText(/牧场.*成年.*鸡蛋.*1.*待领取/);
  await expect(settlement).toContainText("收获产物或重置沙盒后，可重新观察成长过程");

  await advance.click();
  await expect(settlement).toHaveAttribute("data-settlement-sequence", "10");
});

test("preview sandbox advances a complete fish, crop, and chicken lifecycle", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const sandbox = page.getByRole("region", { name: "预览测试沙盒" });
  await expect(sandbox.getByRole("button", { name: "生态快进 6 小时" })).toBeEnabled();

  let drawer = await openHabitatDrawer(page, "aquarium", "鱼缸");
  await drawer.getByRole("button", { name: "投喂鱼缸" }).click();
  drawer = await advanceUntilDrawerMatches(page, "aquarium", "鱼缸", /阶段[：:\s]*成鱼/, 5);
  await expect(drawer.getByRole("button", { name: "收获" })).toHaveCount(0);

  await resetEcosystemSandbox(page);
  drawer = await openHabitatDrawer(page, "garden", "种植园");
  await drawer.getByRole("button", { name: "施肥种植园" }).click();
  drawer = await advanceUntilDrawerMatches(page, "garden", "种植园", /阶段[：:\s]*成熟/, 4);
  await expect(drawer).toContainText(/产出[：:\s]*胡萝卜\s*(?:[×x]\s*)?1/);
  const harvestCrop = drawer.getByRole("button", { name: "收获" });
  await expect(harvestCrop).toBeEnabled();
  await harvestCrop.click();
  await expect(drawer).toContainText(/产出[：:\s]*(?:暂无|无|0)/);
  await expect(harvestCrop).toBeDisabled();

  await resetEcosystemSandbox(page);
  drawer = await openHabitatDrawer(page, "animals", "牧场");
  await drawer.getByRole("button", { name: "喂食牧场" }).click();
  drawer = await advanceUntilDrawerMatches(page, "animals", "牧场", /阶段[：:\s]*成年/, 6);
  drawer = await advanceUntilDrawerMatches(
    page,
    "animals",
    "牧场",
    /产出[：:\s]*鸡蛋\s*(?:[×x]\s*)?1/,
    6,
  );
  const groundEgg = page.getByRole("button", { name: "拾取鸡蛋 1" });
  await expect(groundEgg).toBeVisible();
  await expect(groundEgg).toHaveAttribute("data-ground-produce", "egg");
  await groundEgg.click();
  await expect(groundEgg).toHaveCount(0);
  await expect(drawer).toContainText(/产出[：:\s]*(?:暂无|无|0)/);
  await expect(drawer.getByRole("button", { name: "收获" })).toBeDisabled();
});

test("essential ribbon stays compact while scene-bound controls open on demand", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const deck = page.locator(".ecosystem-scene__command-deck");
  const workbench = page.locator(".ecosystem-widget");
  const goal = page.getByRole("region", { name: "当前目标" });
  const switcher = page.locator(".ecosystem-scene__switcher");
  const launchers = page.locator(".widget-launchers");
  const commandBar = page.getByRole("region", { name: "工作台控制" });
  const beforeDeck = await requiredBoundingBox(deck);
  const beforeWorkbench = await requiredBoundingBox(workbench);

  expect(beforeDeck.height).toBeLessThanOrEqual(40);
  const gap = beforeWorkbench.y - (beforeDeck.y + beforeDeck.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(8);
  for (const child of [goal, switcher]) {
    expectBoxContains(beforeDeck, await requiredBoundingBox(child));
  }
  const commandBarBox = await requiredBoundingBox(commandBar);
  expect(commandBarBox.height).toBeLessThanOrEqual(39);
  expect(await launchers.count()).toBe(0);
  expect(await page.getByRole("button", { name: "投喂鱼缸" }).count()).toBe(0);

  await page.getByRole("button", { name: "打开鱼缸养成抽屉" }).click();
  const habitatDrawer = page.getByRole("region", { name: "鱼缸养成抽屉" });
  await expect(habitatDrawer).toBeVisible();
  await expect(habitatDrawer).toContainText("鱼食 1");
  await expect(page.getByRole("button", { name: "投喂鱼缸" })).toBeEnabled();
  expect(await requiredBoundingBox(deck)).toEqual(beforeDeck);
  await page.getByRole("button", { name: "收起鱼缸养成抽屉" }).click();

  await page.getByRole("button", { name: "下一处养成场景" }).click();
  await expect(page.getByRole("region", { name: "养成生态", exact: true })).toContainText("种植园 2 / 3");
  expect(await requiredBoundingBox(deck)).toEqual(beforeDeck);
  expect(await requiredBoundingBox(workbench)).toEqual(beforeWorkbench);

  const toolTrigger = page.getByRole("button", { name: "打开老虎机工具抽屉" });
  await expect(toolTrigger).toHaveAttribute("aria-expanded", "false");
  await toolTrigger.click();
  await expect(toolTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(launchers.getByRole("button")).toHaveCount(3);
  await page.getByRole("button", { name: "打开收藏盒" }).click();
  await expect(launchers).toHaveCount(0);
  const panel = page.getByRole("dialog", { name: "收藏盒" });
  await expect(panel).toBeVisible();
  expect(await requiredBoundingBox(deck)).toEqual(beforeDeck);
  expect(await requiredBoundingBox(workbench)).toEqual(beforeWorkbench);
  expect(boxesOverlap(await requiredBoundingBox(panel), beforeWorkbench)).toBe(false);
});

test("preview sandbox restores exhausted feeding supplies and a reusable lever", async ({ page }) => {
  await page.setViewportSize({ width: 1_024, height: 576 });
  await page.goto("/native-preview.html");
  await waitForCanvasReady(page);

  const sandbox = page.getByRole("region", { name: "预览测试沙盒" });
  const lever = page.getByRole("button", { name: "拉下右侧摇杆" });
  await expect(sandbox).toBeVisible();
  await page.getByRole("button", { name: "上一处养成场景" }).click();
  await page.getByRole("button", { name: "打开牧场养成抽屉" }).click();
  const feed = page.getByRole("button", { name: "喂食牧场" });
  await expect(feed).toBeEnabled();
  await feed.click();
  await expect(page.getByText("动物饲料 0", { exact: true })).toBeVisible();
  await expect(feed).toBeDisabled();

  await page.getByRole("button", { name: "补满测试资源" }).click();
  await expect(sandbox.getByRole("status")).toContainText("三类养成资源各 9");
  await expect(page.getByTestId("wallet-count")).toHaveText("99");
  await expect(page.getByRole("region", { name: "牧场养成抽屉" })).toBeVisible();
  const refilledFeed = page.getByRole("button", { name: "喂食牧场" });
  await expect(page.getByText("动物饲料 9", { exact: true })).toBeVisible();
  await expect(refilledFeed).toBeEnabled();
  await refilledFeed.click();
  await expect(page.getByText("动物饲料 8", { exact: true })).toBeVisible();

  await expect(lever).toBeEnabled();
  await lever.click();
  await expect(page.getByTestId("wallet-count")).toHaveText("98");

  await page.getByRole("button", { name: "重置测试沙盒" }).click();
  await expect(sandbox.getByRole("status")).toContainText("已恢复初始状态");
  await expect(page.getByTestId("wallet-count")).toHaveText("8");
  await page.getByRole("button", { name: "打开鱼缸养成抽屉" }).click();
  await expect(page.getByText("鱼食 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "拉下右侧摇杆" })).toBeEnabled();
});

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

    await page.addInitScript(() => {
      Math.random = () => 0.7;
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
    await expect(page.getByText("实际 Token：1,850 / 10,000")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "实际 Token 进度" }))
      .toHaveAttribute("aria-valuenow", "1850");
    await expect(page.getByText("今日 Token 奖励：3 / 8")).toBeVisible();

    const leverControl = page.getByRole("button", { name: "拉下右侧摇杆" });
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
    await expect(page.getByTestId("wallet-count")).toHaveText("7");
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
    await expect(page.getByRole("dialog", { name: "开奖结果" })).toContainText("获得 5 枚硬币");
    await expect(page.getByRole("dialog", { name: "开奖结果" })).toContainText("三枚金币连线奖励");
    await expect(leverControl).toBeEnabled();
    await captureQaScreenshot(
      page,
      testInfo,
      `native-preview-settled-${viewport.name}.png`,
    );

    const widgetBox = await requiredBoundingBox(page.locator(".slot-widget"));
    const hostStatusBox = await requiredBoundingBox(page.locator(".host-status"));
    const toolTriggerBox = await requiredBoundingBox(page.getByRole("button", { name: "打开老虎机工具抽屉" }));
    const goalBox = await requiredBoundingBox(page.getByRole("region", { name: "当前目标" }));
    const resultBox = await requiredBoundingBox(page.getByRole("dialog", { name: "开奖结果" }));
    for (const box of [widgetBox, hostStatusBox, toolTriggerBox, goalBox, resultBox]) {
      expectBoxInsideViewport(box, viewport);
    }
    expect(boxesOverlap(widgetBox, hostStatusBox)).toBe(false);
    expect(boxesOverlap(widgetBox, resultBox)).toBe(false);
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

async function expectHabitatArtworkLoaded(
  page: Page,
  habitat: (typeof HABITAT_ARTWORK)[number]["id"],
  habitatBay: Locator,
): Promise<void> {
  const stage = page.locator(`.ecosystem-scene__habitat-stage[data-habitat="${habitat}"]`);
  const image = stage.locator("img.ecosystem-scene__habitat-layer");

  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate((element) => {
    const artwork = element as HTMLImageElement;
    return artwork.complete && artwork.naturalWidth > 0 && artwork.naturalHeight > 0;
  })).toBe(true);

  const metrics = await image.evaluate((element) => {
    const artwork = element as HTMLImageElement;
    return {
      complete: artwork.complete,
      naturalWidth: artwork.naturalWidth,
      naturalHeight: artwork.naturalHeight,
      opacity: Number(getComputedStyle(artwork).opacity),
    };
  });
  expect(metrics.complete).toBe(true);
  expect(metrics.naturalWidth).toBeGreaterThan(0);
  expect(metrics.naturalHeight).toBeGreaterThan(0);
  expect(metrics.opacity).toBeGreaterThan(0);
  expect(boxesOverlap(
    await requiredBoundingBox(image),
    await requiredBoundingBox(habitatBay),
  )).toBe(true);
}

async function firstPaintOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((element) => new Promise<number>((resolve) => {
    requestAnimationFrame(() => {
      resolve(Number(getComputedStyle(element).opacity));
    });
  }));
}

async function expectSpriteSheetLoaded(resident: Locator): Promise<void> {
  const sprite = resident.locator(".ecosystem-resident-sprite").first();
  await expect(sprite).toBeVisible();
  await expect.poll(() => sprite.evaluate((element) => new Promise<boolean>((resolve) => {
    const background = getComputedStyle(element).backgroundImage;
    const match = background.match(/^url\(["']?(.*?)["']?\)$/);
    if (match?.[1] === undefined) {
      resolve(false);
      return;
    }
    const image = new Image();
    image.addEventListener("load", () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0), { once: true });
    image.addEventListener("error", () => resolve(false), { once: true });
    image.src = match[1];
  }))).toBe(true);
}

async function expectResidentBoxAtLeast(resident: Locator, minimumWidth: number): Promise<void> {
  const box = await resident.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(minimumWidth);
}

async function openHabitatDrawer(
  page: Page,
  habitat: (typeof HABITAT_ARTWORK)[number]["id"],
  title: (typeof HABITAT_ARTWORK)[number]["title"],
): Promise<Locator> {
  const nextHabitat = page.getByRole("button", { name: "下一处养成场景" });
  const expectedStage = page.locator(`.ecosystem-scene__habitat-stage[data-habitat="${habitat}"]`);
  for (let attempts = 0; attempts < HABITAT_ARTWORK.length && await expectedStage.count() === 0; attempts += 1) {
    await nextHabitat.click();
  }
  await expect(expectedStage).toHaveCount(1);

  const drawer = page.getByRole("region", { name: `${title}养成抽屉` });
  if (await drawer.count() === 0) {
    await page.getByRole("button", { name: `打开${title}养成抽屉` }).click();
  }
  await expect(drawer).toBeVisible();
  return drawer;
}

async function advanceEcosystemSixHours(page: Page): Promise<void> {
  await page.getByRole("region", { name: "预览测试沙盒" })
    .getByRole("button", { name: "生态快进 6 小时" })
    .click();
}

async function resetEcosystemSandbox(page: Page): Promise<void> {
  await page.getByRole("region", { name: "预览测试沙盒" })
    .getByRole("button", { name: "重置测试沙盒" })
    .click();
  await expect(page.getByRole("region", { name: "预览测试沙盒" }).getByRole("status"))
    .toContainText("已恢复初始状态");
}

async function advanceUntilDrawerMatches(
  page: Page,
  habitat: (typeof HABITAT_ARTWORK)[number]["id"],
  title: (typeof HABITAT_ARTWORK)[number]["title"],
  pattern: RegExp,
  maxAdvances: number,
): Promise<Locator> {
  let drawer = await openHabitatDrawer(page, habitat, title);
  for (let advances = 0; advances < maxAdvances; advances += 1) {
    if (pattern.test((await drawer.textContent()) ?? "")) return drawer;
    await advanceEcosystemSixHours(page);
    drawer = await openHabitatDrawer(page, habitat, title);
  }
  await expect(drawer).toContainText(pattern);
  return drawer;
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

function expectBoxContains(parent: BoundingBox, child: BoundingBox): void {
  expect(child.x).toBeGreaterThanOrEqual(parent.x);
  expect(child.y).toBeGreaterThanOrEqual(parent.y);
  expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width);
  expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height);
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
