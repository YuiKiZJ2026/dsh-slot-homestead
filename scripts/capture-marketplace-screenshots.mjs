import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const previewUrlFromEnvironment = process.env.SLOT_HOMESTEAD_PREVIEW_URL?.replace(/\/$/, "");
const previewUrl = previewUrlFromEnvironment ?? "http://127.0.0.1:4174";
const viewport = { width: 1280, height: 720 };
const screenshotSize = { width: 880, height: 495 };

const scenes = [
  {
    file: "docs/demo-preview.png",
    fixedTime: "2026-09-02T22:30:00+08:00",
    habitat: "aquarium",
    title: "鱼缸",
    care: "投喂鱼缸",
    advances: 8,
  },
  {
    file: "docs/screenshots/02-garden-day.png",
    fixedTime: "2026-09-02T09:30:00+08:00",
    habitat: "garden",
    title: "种植园",
    care: "施肥种植园",
    advances: 4,
  },
  {
    file: "docs/screenshots/03-pasture-night.png",
    fixedTime: "2026-09-02T22:30:00+08:00",
    habitat: "animals",
    title: "牧场",
    care: "喂食牧场",
    advances: 12,
  },
  {
    file: "docs/screenshots/04-slot-result.png",
    fixedTime: "2026-09-02T09:30:00+08:00",
    habitat: "aquarium",
    title: "鱼缸",
    advances: 0,
    spin: true,
  },
];

let previewProcess;

async function waitForPreview(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/native-preview.html`);
      if (response.ok) return;
    } catch {
      // The local preview may still be starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Preview did not become ready at ${url}`);
}

async function openHabitat(page, scene) {
  const stage = page.locator(
    `.ecosystem-scene__habitat-stage[data-habitat="${scene.habitat}"]`,
  );
  for (let attempts = 0; attempts < 3 && await stage.count() === 0; attempts += 1) {
    await page.getByRole("button", { name: "下一处养成场景" }).click();
  }
  if (await stage.count() !== 1) {
    throw new Error(`Could not open ${scene.title}`);
  }
}

async function prepareScene(page, scene) {
  await page.addInitScript(() => {
    Math.random = () => 0.7;
  });
  await page.clock.setFixedTime(new Date(scene.fixedTime));
  await page.goto(`${previewUrl}/native-preview.html`, { waitUntil: "networkidle" });
  await page.locator("canvas[data-render-state]").waitFor({ state: "visible" });
  await page.waitForFunction(() => (
    document.querySelector("canvas[data-render-state]")?.getAttribute("data-render-state") === "ready"
  ));

  const sandbox = page.getByRole("region", { name: "预览测试沙盒" });
  await openHabitat(page, scene);

  if (scene.care !== undefined) {
    await sandbox.getByRole("button", { name: "补满测试资源" }).click();
    await page.getByRole("button", { name: `打开${scene.title}养成抽屉` }).click();
    await page.getByRole("button", { name: scene.care }).click();
    await page.getByRole("button", { name: `收起${scene.title}养成抽屉` }).click();
  }

  for (let index = 0; index < scene.advances; index += 1) {
    await sandbox.getByRole("button", { name: "生态快进 6 小时" }).click();
  }

  if (scene.spin === true) {
    await page.getByRole("button", { name: "拉下右侧摇杆" }).click();
    await page.getByRole("dialog", { name: "开奖结果" }).waitFor({ state: "visible" });
  }

  const hiddenSelectors = [
    ".preview-sandbox",
    ".preview-ecosystem-settlement",
    ".host-status",
    ".wallet-status",
    ".daylight-status",
    ".ecosystem-scene__care-feedback",
  ];
  if (scene.spin !== true) hiddenSelectors.push(".utility-panel-slot");
  await page.addStyleTag({ content: `
    ${scene.spin === true ? ".desktop { --edge-bottom: 190px !important; }" : ""}
    ${hiddenSelectors.join(",\n    ")} {
      display: none !important;
    }
  ` });
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
}

async function captureScene(browser, scene) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
  });
  const page = await context.newPage();
  try {
    await prepareScene(page, scene);
    const widgetBox = await page.locator(".ecosystem-widget").boundingBox();
    if (widgetBox === null) throw new Error("The ecosystem widget is not visible");
    const clip = scene.spin === true ? {
      x: 124,
      y: 61,
      width: 1100,
      height: 619,
    } : {
      x: Math.round(widgetBox.x + widgetBox.width - screenshotSize.width),
      y: viewport.height - screenshotSize.height,
      ...screenshotSize,
    };
    await page.screenshot({
      path: resolve(scene.file),
      clip,
      animations: "disabled",
    });
  } finally {
    await context.close();
  }
}

try {
  await mkdir(resolve("docs/screenshots"), { recursive: true });
  if (previewUrlFromEnvironment === undefined) {
    previewProcess = spawn(
      process.execPath,
      [resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
      { stdio: "inherit" },
    );
  }
  await waitForPreview(previewUrl);
  const browser = await chromium.launch();
  try {
    for (const scene of scenes) await captureScene(browser, scene);
  } finally {
    await browser.close();
  }
} finally {
  previewProcess?.kill();
}
