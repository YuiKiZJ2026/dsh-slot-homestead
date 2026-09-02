import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SceneAssets, SceneAssetUrls } from "../../game/renderer/assets";
import type { CommandRequest, CommandResult, PublicSnapshot } from "../shared/contracts";
import type { GameApi } from "./api";
import { normalizeCompanionScale, PluginApp } from "./PluginApp";
import { PLUGIN_STYLE } from "./style";
import { createInitialEcosystemState } from "../../domain/types";
import { FixedClock } from "../../time/clock";

const ASSET_URLS: SceneAssetUrls = {
  scene: "data:image/png;base64,scene",
  reels: "data:image/png;base64,reels",
  collectibles: "data:image/png;base64,collectibles",
};
const neverLoads = () => new Promise<SceneAssets>(() => undefined);
const READY_ASSETS: SceneAssets = {
  scene: {} as HTMLImageElement,
  reels: {} as HTMLImageElement,
  collectibles: {} as HTMLImageElement,
};
const loadsReady = () => Promise.resolve(READY_ASSETS);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PluginApp", () => {
  it("snaps Windows frame rounding back to the default scale", () => {
    expect(normalizeCompanionScale(1.006)).toBe(1);
    expect(normalizeCompanionScale(1.2545)).toBe(1.25);
  });

  it("uses the injected system-light clock and shows its label on the full page", () => {
    const { container } = render(
      <PluginApp
        api={new StaticApi(snapshot())}
        sessionId="official-session-id"
        assetUrls={ASSET_URLS}
        loadAssets={neverLoads}
        lightingClock={new FixedClock(new Date(2026, 7, 31, 17, 0))}
        displayMode="page"
      />,
    );

    expect(screen.getByRole("application", { name: "DSH 桌面老虎机" }))
      .toHaveAttribute("data-day-phase", "dusk");
    expect(screen.getByRole("status", { name: "当前系统光照：傍晚暖光" }))
      .toHaveTextContent("光照傍晚暖光");
    expect(container.querySelector('[data-night-sky="moon-stars"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector('[data-night-sky="moon-stars"]')).toHaveAttribute(
      "data-night-anchor",
      "workbench",
    );
    expect(container.querySelector('[data-night-moonlight="workbench"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const moon = container.querySelector<HTMLElement>(".desktop__pixel-moon");
    expect(moon).toHaveAttribute("data-moon-art", "hand-drawn-pixels");
    expect(moon).toHaveAttribute("data-moon-phase", "crescent");
    expect(moon).toHaveAttribute("data-moon-style", "rounded-crescent");
    expect(moon).toHaveAttribute("data-moon-arc", "offset-circles");
    expect(moon?.tagName.toLowerCase()).toBe("svg");
    expect(moon).toHaveAttribute("viewBox", "0 0 217 217");
    expect(moon).toHaveAttribute("width", "217");
    expect(moon).toHaveAttribute("height", "217");
    expect(moon).toHaveAttribute("shape-rendering", "crispEdges");
    const moonPixels = Array.from(moon?.querySelectorAll("rect[data-moon-pixel]") ?? []);
    expect(moonPixels.length).toBeGreaterThanOrEqual(90);
    moonPixels.forEach((pixel) => {
      for (const attribute of ["x", "y", "width", "height"] as const) {
        expect(pixel).toHaveAttribute(attribute);
        expect(Number(pixel.getAttribute(attribute)) % 7).toBe(0);
      }
      expect(Number(pixel.getAttribute("x"))).toBeGreaterThanOrEqual(0);
      expect(Number(pixel.getAttribute("y"))).toBeGreaterThanOrEqual(0);
      expect(Number(pixel.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(pixel.getAttribute("height"))).toBe(7);
      expect(Number(pixel.getAttribute("x")) + Number(pixel.getAttribute("width")))
        .toBeLessThanOrEqual(217);
      expect(Number(pixel.getAttribute("y")) + Number(pixel.getAttribute("height")))
        .toBeLessThanOrEqual(217);
    });
    expect(moon?.querySelector('rect[x="0"][y="0"][width="217"][height="217"]'))
      .not.toBeInTheDocument();
    expectRoundedCrescentGeometry(moonPixels);
    const starOffsets = Array.from(container.querySelectorAll<HTMLElement>("[data-star-index]"))
      .map((star) => Number.parseFloat(star.style.left));
    expect(Math.max(...starOffsets)).toBeLessThanOrEqual(104);
    const slot = container.querySelector(".slot-widget");
    for (const light of ["cabinet", "marquee", "reels", "control-panel"] as const) {
      expect(slot?.querySelector(`[data-slot-night-light="${light}"]`)).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
    expect(PLUGIN_STYLE).toContain('.dsh-slot-widget-root[data-day-phase="night"]');
    expect(PLUGIN_STYLE).toContain("filter: var(--daylight-scene-filter);");
    expect(PLUGIN_STYLE).toContain(".desktop__night-sky");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__night-glow");
    expect(PLUGIN_STYLE).toContain('[data-day-phase="night"] .desktop__night-sky');
    expect(PLUGIN_STYLE).toContain('[data-day-phase="night"] .ecosystem-scene__night-glow');
    expect(PLUGIN_STYLE).toContain("[data-night-moonlight]");
    expect(PLUGIN_STYLE).toContain("[data-night-hotspot]");
    expect(PLUGIN_STYLE).toContain("[data-night-rest]");
    expect(PLUGIN_STYLE).toContain("[data-slot-night-light]");
    expect(PLUGIN_STYLE).toContain("pointer-events: none;");
    expect(PLUGIN_STYLE).not.toContain(".slot-widget::before");
  });

  it("keeps plugin moonlight soft without polygon clipping", () => {
    const moonlight = cssRule(
      PLUGIN_STYLE,
      ".dsh-slot-widget-root .ecosystem-widget [data-night-moonlight]",
    );

    expect(moonlight).not.toMatch(/clip-path\s*:\s*polygon/i);
  });

  it("renders the plugin's detailed 31 by 31 rounded crescent at the compact 63px display size", () => {
    const sky = cssRule(PLUGIN_STYLE, ".dsh-slot-widget-root .desktop__night-sky");
    const moon = cssRule(PLUGIN_STYLE, ".dsh-slot-widget-root .desktop__pixel-moon");

    expect(sky).toMatch(/top:\s*-116px/);
    expect(sky).toMatch(/left:\s*-132px/);
    expect(sky).toMatch(/width:\s*128px/);
    expect(moon).toMatch(/width:\s*63px/);
    expect(moon).toMatch(/height:\s*63px/);
    expect(moon).not.toMatch(/clip-path\s*:\s*polygon/i);
  });

  it("intensifies plugin aquarium and garden washes without changing the pasture baseline", () => {
    const aquarium = cssRule(
      PLUGIN_STYLE,
      ".dsh-slot-widget-root .ecosystem-scene__night-glow--aquarium",
    );
    const garden = cssRule(
      PLUGIN_STYLE,
      ".dsh-slot-widget-root .ecosystem-scene__night-glow--garden",
    );
    const animals = cssRule(
      PLUGIN_STYLE,
      ".dsh-slot-widget-root .ecosystem-scene__night-glow--animals",
    );

    expect(rgbaAlphas(aquarium)[0]).toBeGreaterThanOrEqual(0.34);
    expect(rgbaAlphas(garden)[0]).toBeGreaterThanOrEqual(0.38);
    expect(rgbaAlphas(animals).slice(0, 2)).toEqual([0.3, 0.14]);
  });

  it("raises only plugin aquarium and garden opacity above the shared pasture baseline", () => {
    const shared = cssRule(
      PLUGIN_STYLE,
      '.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow',
    );
    const aquarium = cssRule(
      PLUGIN_STYLE,
      '.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow--aquarium',
    );
    const garden = cssRule(
      PLUGIN_STYLE,
      '.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow--garden',
    );

    expect(cssNumericProperty(shared, "opacity")).toBeCloseTo(0.74);
    expect(cssNumericProperty(aquarium, "opacity")).toBeGreaterThanOrEqual(0.88);
    expect(cssNumericProperty(garden, "opacity")).toBeGreaterThanOrEqual(0.88);
  });

  it("lights the plugin slot cabinet without drawing glass-panel borders", () => {
    for (const light of ["cabinet", "reels", "control-panel"] as const) {
      const nightRule = cssRule(
        PLUGIN_STYLE,
        `.dsh-slot-widget-root[data-day-phase="night"] .slot-night-light--${light}`,
      );
      expect(cssNumericProperty(nightRule, "opacity")).toBeGreaterThanOrEqual(0.88);
    }

    const cabinet = cssRule(PLUGIN_STYLE, ".dsh-slot-widget-root .slot-night-light--cabinet");
    expectNoVisiblePanelChrome(cabinet);
    expect(cssDeclaration(cabinet, "background").match(/radial-gradient/gi)?.length ?? 0)
      .toBeGreaterThanOrEqual(2);
  });

  it("keeps plugin reel and control reflections subtle and free of glowing outlines", () => {
    for (const light of ["reels", "control-panel"] as const) {
      const rule = cssRule(PLUGIN_STYLE, `.dsh-slot-widget-root .slot-night-light--${light}`);
      expectNoVisiblePanelChrome(rule);
      const reflectionAlphas = rgbaAlphas(cssDeclaration(rule, "background"));
      expect(reflectionAlphas.length).toBeGreaterThan(0);
      expect(Math.max(...reflectionAlphas)).toBeLessThanOrEqual(0.22);
    }
  });

  it("brightens the plugin slot canvas as one warm cabinet at night", () => {
    const rule = cssRule(
      PLUGIN_STYLE,
      '.dsh-slot-widget-root[data-day-phase="night"] .slot-widget canvas',
    );
    const filter = cssDeclaration(rule, "filter");

    expect(cssFunctionNumber(filter, "brightness")).toBeGreaterThanOrEqual(0.64);
    expect(filter).toMatch(/(?:saturate|drop-shadow)\(/i);
  });

  it("keeps plugin broad habitat lighting steady and freezes the wick for reduced motion", () => {
    const broadGlow = cssRule(
      PLUGIN_STYLE,
      '.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-glow',
    );
    const wick = cssRule(
      PLUGIN_STYLE,
      '.dsh-slot-widget-root[data-day-phase="night"] .ecosystem-scene__night-hotspot',
    );
    const reducedMotion = PLUGIN_STYLE.slice(PLUGIN_STYLE.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(broadGlow).not.toMatch(/animation\s*:/i);
    expect(wick).toMatch(/animation\s*:/i);
    expect(reducedMotion).toMatch(
      /\.ecosystem-scene__night-hotspot,[\s\S]*?\{[^}]*animation:\s*none\s*!important;/,
    );
  });

  it("keeps the plugin pasture active by day and resting at night", async () => {
    const lightingClock = new FixedClock(new Date(2026, 7, 31, 20, 0));
    const { container } = render(
      <PluginApp
        api={new StaticApi(snapshot())}
        sessionId="official-session-id"
        assetUrls={ASSET_URLS}
        loadAssets={neverLoads}
        lightingClock={lightingClock}
        displayMode="page"
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "上一处养成场景" }));
    const pasture = () => container.querySelector('.ecosystem-scene__habitat-stage[data-habitat="animals"]');
    expect(pasture()?.querySelector('[data-resident-id]')).not.toBeInTheDocument();
    expect(pasture()?.querySelector('[data-night-rest="animals"]'))
      .toHaveAttribute("data-routine-state", "resting");

    lightingClock.set(new Date(2026, 7, 31, 9, 0));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(pasture()?.querySelector('[data-night-rest="animals"]')).not.toBeInTheDocument();
    expect(pasture()?.querySelector('[data-resident-id="chick"]'))
      .toHaveAttribute("data-routine-state", "active");
  });

  it.each(["overlay", "companion"] as const)(
    "keeps the lighting effect but removes the obstructing status label in %s mode",
    (displayMode) => {
      render(
        <PluginApp
          api={new StaticApi(snapshot())}
          sessionId="official-session-id"
          assetUrls={ASSET_URLS}
          loadAssets={neverLoads}
          lightingClock={new FixedClock(new Date(2026, 7, 31, 20, 0))}
          displayMode={displayMode}
        />,
      );

      expect(screen.getByRole("application", { name: "DSH 桌面老虎机" }))
        .toHaveAttribute("data-day-phase", "night");
      expect(screen.queryByRole("status", { name: "当前系统光照：夜间熄灯" }))
        .not.toBeInTheDocument();
    },
  );

  it("uses the slot scene as the native drag surface and renders a text-free collapsed tab", async () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(560);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(330);
    const { container } = render(
      <PluginApp
        api={new StaticApi(snapshot())}
        sessionId="official-session-id"
        assetUrls={ASSET_URLS}
        loadAssets={neverLoads}
        displayMode="companion"
      />,
    );

    expect(screen.queryByText("拖动老虎机 · 靠边自动收起")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开老虎机" })).toHaveTextContent("◆");
    expect(PLUGIN_STYLE).toContain(".desktop--companion .game-canvas-wrap { -webkit-app-region: drag;");
    expect(container.querySelectorAll(".table-drop-hit-zone")).toHaveLength(3);
    expect(PLUGIN_STYLE).toContain(".desktop--companion .table-drop-hit-zone { -webkit-app-region: no-drag;");
    expect(PLUGIN_STYLE).toContain(".desktop--overlay .ecosystem-scene button { pointer-events: auto;");
    expect(PLUGIN_STYLE).toContain("--widget-width: 641px;");
    expect(PLUGIN_STYLE).toContain("--widget-height: 277px;");
    expect(PLUGIN_STYLE).toContain(".plugin-game-layout { display: grid; grid-template-columns: minmax(0,var(--widget-width)) minmax(280px,344px);");
    expect(PLUGIN_STYLE).toContain(".ecosystem-widget { position: relative; display: block; width: 704px; height: 304px; transform: scale(var(--widget-scale)) scale(.91);");
    expect(PLUGIN_STYLE).toContain(".slot-widget { position: absolute; top: 0; left: 320px; z-index: 3; width: 384px; height: 288px;");
    expect(PLUGIN_STYLE).toContain(".slot-widget canvas { display: block; width: 384px; height: 288px; filter: var(--daylight-scene-filter); image-rendering: pixelated;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene { position: absolute; inset: 0; z-index: 1; display: block; width: 704px; height: 304px;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__command-deck { position: absolute; right: 0; bottom: calc(100% + 2px); z-index: 6; display: grid; width: 704px;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__command-deck { position: absolute; right: 0; bottom: calc(100% + 2px); z-index: 6; display: grid; width: 704px; height: 42px; grid-template-columns: minmax(0,1fr) 196px; gap: 0; border: 1px solid #6f5534; padding: 3px;");
    expect(PLUGIN_STYLE).toContain(".workbench-command-bar { display: grid; height: 100%; grid-template-columns: minmax(0,1fr);");
    expect(PLUGIN_STYLE).toContain(".current-goal { display: grid; min-width: 0; height: 100%; grid-template-columns: 52px 114px minmax(0,1fr) 86px;");
    expect(PLUGIN_STYLE).toContain(".widget-launchers { display: grid; width: 132px; min-width: 132px;");
    expect(PLUGIN_STYLE).toContain(".widget-launchers .pixel-button { width: 100%; min-width: 0; height: 100%; min-height: 0; border: 0; border-left: 1px solid rgba(107,151,158,.38); border-radius: 0;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__habitat-drawer { position: absolute; top: 216px; left: 40px; z-index: 6; display: grid; width: 276px;");
    expect(PLUGIN_STYLE).toContain(".slot-tool-console { position: absolute; top: 127px; left: 181px; z-index: 8;");
    expect(PLUGIN_STYLE).not.toContain("top: -220px");
    expect(PLUGIN_STYLE).not.toContain(".ecosystem-scene--aquarium .ecosystem-scene__art { scale:");
    expect(PLUGIN_STYLE).not.toContain(".ecosystem-scene--garden .ecosystem-scene__art { scale:");
    expect(PLUGIN_STYLE).not.toContain(".ecosystem-scene--animals .ecosystem-scene__art { scale:");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__table-base { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%;");
    expect(PLUGIN_STYLE).toContain("object-fit: contain; object-position: right bottom;");
    expect(PLUGIN_STYLE).not.toContain("scaleY(1.69)");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__habitat-bay { position: absolute; top: 8px; left: 32px; z-index: 2; width: 292px; height: 210px; overflow: hidden;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__habitat-stage { position: absolute; z-index: 1;");
    expect(PLUGIN_STYLE).not.toMatch(/@keyframes dsh-habitat-enter-(?:previous|next)\s*\{[^}]*opacity:\s*0/);
    expect(PLUGIN_STYLE).not.toContain("aspect-ratio: 49/36;");
    expect(PLUGIN_STYLE).not.toContain(".ecosystem-scene--aquarium .ecosystem-scene__habitat-stage");
    expect(PLUGIN_STYLE).not.toContain(".ecosystem-scene--garden .ecosystem-scene__habitat-stage");
    expect(PLUGIN_STYLE).not.toContain(".ecosystem-scene--animals .ecosystem-scene__habitat-stage");
    expect(PLUGIN_STYLE).toContain(".ecosystem-plot-cell .ecosystem-motion-layer { top: auto; bottom: 24%;");
    expect(PLUGIN_STYLE).toContain("left: 50%; margin: 0; translate: -50% 0;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-resident-interaction { margin: 0; border: 0;");
    expect(PLUGIN_STYLE).toContain("@media (max-width: 60px), (max-height: 60px)");
    expect(PLUGIN_STYLE).toContain("> :not(.edge-reveal-tab) { display: none !important;");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-fish-swim-a");
    expect(PLUGIN_STYLE).toContain(".ecosystem-motion-layer--fish-gold { top: 35%; left: 19%; width: 17%;");
    expect(PLUGIN_STYLE).toContain('[data-day-phase="night"] .ecosystem-scene--aquarium [data-motion="swim"] .ecosystem-resident-sprite');
    expect(PLUGIN_STYLE).toContain("0% { transform: translate3d(92px,0,0) scaleX(-1); }");
    expect(PLUGIN_STYLE).toContain("49.99% { transform: translate3d(0,5px,0) scaleX(-1); }");
    expect(PLUGIN_STYLE).toContain("50% { transform: translate3d(0,5px,0) scaleX(1); }");
    expect(PLUGIN_STYLE).toContain("99.99% { transform: translate3d(92px,0,0) scaleX(1); }");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-fish-swim-b");
    expect(PLUGIN_STYLE).toContain("0% { transform: translate3d(84px,0,0) scaleX(-1); }");
    expect(PLUGIN_STYLE).toContain("49.99% { transform: translate3d(0,-5px,0) scaleX(-1); }");
    expect(PLUGIN_STYLE).toContain("50% { transform: translate3d(0,-5px,0) scaleX(1); }");
    expect(PLUGIN_STYLE).toContain("99.99% { transform: translate3d(84px,0,0) scaleX(1); }");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-chick-ecosystem");
    expect(PLUGIN_STYLE).toContain("34.99% { transform: translate3d(-38px,0,0) scaleX(1)");
    expect(PLUGIN_STYLE).toContain("35% { transform: translate3d(-38px,0,0) scaleX(-1)");
    expect(PLUGIN_STYLE).toContain("61%,66% { transform: translate3d(58px,4px,0)");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-rabbit-ecosystem");
    expect(PLUGIN_STYLE).toContain("13% { transform: translate3d(-18px,-10px,0)");
    expect(PLUGIN_STYLE).toContain("31.99% { transform: translate3d(-36px,3px,0) scaleX(1)");
    expect(PLUGIN_STYLE).toContain("32% { transform: translate3d(-36px,3px,0) scaleX(-1)");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-alpaca-ecosystem");
    expect(PLUGIN_STYLE).toContain("38.99% { transform: translate3d(-38px,4px,0) scaleX(1)");
    expect(PLUGIN_STYLE).toContain("39% { transform: translate3d(-38px,4px,0) scaleX(-1)");
    expect(PLUGIN_STYLE).toContain("ecosystem-plot-cell--1 { top: 28%; left: 28%; }");
    expect(PLUGIN_STYLE).toContain("ecosystem-motion-layer--crop-carrot { width: 82%;");
    expect(PLUGIN_STYLE).toContain("ecosystem-motion-layer--animal-chick { top: 51%; left: 49%; width: 10%;");
    expect(PLUGIN_STYLE).toContain(".ecosystem-scene__reaction {");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-fish-react");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-crop-react");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-animal-react");
    expect(PLUGIN_STYLE).toContain("prefers-reduced-motion: reduce");
    expect(PLUGIN_STYLE).toContain('.pixel-button[aria-expanded="true"]');
    expect(PLUGIN_STYLE).toContain("transition: transform 140ms var(--ease-out);");
    expect(PLUGIN_STYLE).toContain(".pixel-button:active:not(:disabled)");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-habitat-enter-previous");
    expect(PLUGIN_STYLE).toContain("@keyframes dsh-habitat-enter-next");
    expect(PLUGIN_STYLE).toContain("animation: dsh-care-feedback 520ms var(--ease-out) both;");
    expect(PLUGIN_STYLE).toContain("animation: dsh-care-feedback-pixel 520ms steps(5,end) both;");
    expect(container.querySelectorAll(".companion-resize-grip")).toHaveLength(4);
    const surface = container.querySelector<HTMLElement>(".companion-scale-surface");
    expect(surface).not.toBeNull();
    expect(surface).toContainElement(screen.getByRole("region", { name: "Host 游戏状态" }));
    expect(surface).toContainElement(container.querySelector("canvas"));
    expect(Number(container.querySelector<HTMLElement>(".desktop--companion")?.style.getPropertyValue("--companion-scale")))
      .toBeCloseTo(330 / 384, 6);
    expect(container.querySelector<HTMLElement>(".desktop--companion")?.style.getPropertyValue("--widget-width"))
      .toBe("551.26px");
    expect(PLUGIN_STYLE).toContain("transform: scale(var(--companion-scale))");
    const ecosystemWidget = screen.getByRole("region", { name: "老虎机与养成生态" });
    expect(ecosystemWidget).toHaveAttribute("data-composition", "single-workbench-v3");
    const commandBar = screen.getByRole("region", { name: "工作台控制" });
    expect(screen.getByRole("region", { name: "养成生态" })).toContainElement(commandBar);
    expect(commandBar.parentElement).toHaveAttribute("data-layout", "contextual-one-row");
    expect(ecosystemWidget.firstElementChild).toBe(screen.getByRole("region", { name: "养成生态" }));
    expect(ecosystemWidget.lastElementChild).toHaveAttribute("aria-label", "老虎机微缩场景");
  });

  it("uses one 704x304 workbench coordinate space without seam compensation", () => {
    const workbench = cssRule(PLUGIN_STYLE, ".ecosystem-widget");
    const ecosystem = cssRule(PLUGIN_STYLE, ".ecosystem-scene");
    const slot = cssRule(PLUGIN_STYLE, ".slot-widget");
    const canvas = cssRule(PLUGIN_STYLE, ".slot-widget canvas");
    const workbenchWidth = cssPx(workbench, /\bwidth:\s*(\d+)px/);
    const workbenchHeight = cssPx(workbench, /\bheight:\s*(\d+)px/);
    const slotLeft = cssPx(slot, /\bleft:\s*(\d+)px/);
    const slotWidth = cssPx(slot, /\bwidth:\s*(\d+)px/);

    expect([workbenchWidth, workbenchHeight]).toEqual([704, 304]);
    expect(slotLeft + slotWidth).toBe(workbenchWidth);
    expect(cssPx(ecosystem, /\bwidth:\s*(\d+)px/)).toBe(workbenchWidth);
    expect(cssPx(ecosystem, /\bheight:\s*(\d+)px/)).toBe(workbenchHeight);
    expect(`${workbench}${ecosystem}${slot}${canvas}`).not.toMatch(/margin-right|translateX|clip-path/);
  });

  it("renders wallet and Token energy from one Host snapshot status region", async () => {
    render(
      <PluginApp
        api={new StaticApi(snapshot())}
        sessionId="official-session-id"
        assetUrls={ASSET_URLS}
        loadAssets={neverLoads}
      />,
    );

    const status = await screen.findByRole("region", { name: "Host 游戏状态" });
    expect(status).toHaveTextContent("5");
    expect(status).toHaveTextContent("实际 Token：1,850 / 10,000");
    expect(status).toHaveTextContent("今日 Token 奖励：3 / 8");
    expect(status).toHaveTextContent("未连接任务奖励来源");
    expect(screen.getByRole("region", { name: "当前目标" })).toHaveTextContent("保底进度");
    expect(screen.queryByRole("button", { name: "打开工坊" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开老虎机工具抽屉" }));
    expect(screen.getByRole("button", { name: "打开工坊" })).toBeVisible();
    expect(screen.getByRole("region", { name: "养成生态" })).toHaveTextContent("鱼缸 1 / 3");
  });

  it("disables every visible mutation control while a Host command is pending", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext());
    const api = new PendingApi(snapshot({ wallet: 50, inventory: ["plant"] }));
    const user = userEvent.setup();
    render(
      <PluginApp
        api={api}
        sessionId="official-session-id"
        assetUrls={ASSET_URLS}
        loadAssets={loadsReady}
      />,
    );
    const lever = await screen.findByRole("button", { name: "拉下右侧摇杆" });
    await user.click(screen.getByRole("button", { name: "打开老虎机工具抽屉" }));
    await user.click(screen.getByRole("button", { name: "打开收藏盒" }));
    expect(screen.queryByRole("button", { name: "打开收藏盒" })).not.toBeInTheDocument();
    const display = screen.getByRole("gridcell", { name: "小盆栽，仓库中，可拖到桌面" });
    await waitFor(() => expect(lever).toBeEnabled());
    expect(display).toHaveAttribute("draggable", "true");

    await user.click(lever);

    await waitFor(() => expect(lever).toBeDisabled());
    expect(display).toHaveAttribute("draggable", "false");
    expect(api.requests[0]).toMatchObject({
      type: "insertCoin",
      sessionId: "official-session-id",
      expectedRevision: 7,
    });
  });
});

function cssRule(style: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = style.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (match === null) throw new Error(`Missing CSS rule ${selector}`);
  return match[1];
}

function cssNumericProperty(rule: string, property: string): number {
  const match = rule.match(new RegExp(`${property}\\s*:\\s*([.\\d]+)`));
  if (match === null) throw new Error(`Missing numeric ${property} in ${rule}`);
  return Number(match[1]);
}

function cssDeclaration(rule: string, property: string): string {
  const match = rule.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  if (match === null) throw new Error(`Missing ${property} declaration in ${rule}`);
  return match[1].trim();
}

function cssFunctionNumber(value: string, functionName: string): number {
  const match = value.match(new RegExp(`${functionName}\\(\\s*([.\\d]+)`, "i"));
  if (match === null) throw new Error(`Missing ${functionName}() in ${value}`);
  return Number(match[1]);
}

function expectNoVisiblePanelChrome(rule: string): void {
  expect(rule).not.toMatch(/(?:^|;)\s*border(?:-[\w-]+)?\s*:\s*(?!(?:0(?:px)?|none)(?:\s|;|$))/i);
  expect(rule).not.toMatch(/(?:^|;)\s*box-shadow\s*:\s*(?!none(?:\s|;|$))/i);
}

function rgbaAlphas(rule: string): number[] {
  return Array.from(
    rule.matchAll(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([.\d]+)\s*\)/g),
    (match) => Number(match[1]),
  );
}

function occupiedMoonCells(pixels: Element[]): Set<string> {
  const occupied = new Set<string>();
  pixels.forEach((pixel) => {
    const x = Number(pixel.getAttribute("x")) / 7;
    const y = Number(pixel.getAttribute("y")) / 7;
    const width = Number(pixel.getAttribute("width")) / 7;
    const height = Number(pixel.getAttribute("height")) / 7;
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        occupied.add(`${column}:${row}`);
      }
    }
  });
  return occupied;
}

function expectRoundedCrescentGeometry(pixels: Element[]): void {
  const occupied = occupiedMoonCells(pixels);
  expect(occupied.size).toBeGreaterThanOrEqual(220);
  expect(occupied.size).toBeLessThanOrEqual(420);

  const columnsByRow = new Map<number, number[]>();
  occupied.forEach((cell) => {
    const [column, row] = cell.split(":").map(Number);
    const columns = columnsByRow.get(row) ?? [];
    columns.push(column);
    columnsByRow.set(row, columns);
  });
  columnsByRow.forEach((columns) => columns.sort((a, b) => a - b));

  const usedRows = [...columnsByRow.keys()].sort((a, b) => a - b);
  expect(usedRows.length).toBeGreaterThanOrEqual(29);
  expect(usedRows[0]).toBeLessThanOrEqual(1);
  expect(usedRows.at(-1)).toBeGreaterThanOrEqual(29);
  expect(usedRows.at(-1)! - usedRows[0] + 1).toBe(usedRows.length);

  const leftEdges = new Map<number, number>();
  const rightEdges = new Map<number, number>();
  usedRows.forEach((row) => {
    const columns = columnsByRow.get(row)!;
    const left = columns[0];
    const right = columns.at(-1)!;
    expect(right - left + 1).toBe(columns.length);
    leftEdges.set(row, left);
    rightEdges.set(row, right);
  });

  const centerY = (usedRows[0] + usedRows.at(-1)!) / 2;
  expect(Math.abs(centerY - 15)).toBeLessThanOrEqual(0.5);
  const outerRadius = usedRows.length / 2;
  const outerCircleErrors = usedRows.map((row) => {
    const dy = row - centerY;
    const expectedLeft = Math.ceil(
      15 - Math.sqrt(Math.max(0, outerRadius ** 2 - dy ** 2)),
    );
    return Math.abs(leftEdges.get(row)! - expectedLeft);
  });
  expect(Math.max(...outerCircleErrors)).toBeLessThanOrEqual(2);
  expect(outerCircleErrors.reduce((sum, error) => sum + error, 0) / outerCircleErrors.length)
    .toBeLessThanOrEqual(1);

  for (const row of usedRows) {
    const mirrorRow = Math.round(centerY * 2 - row);
    if (!leftEdges.has(mirrorRow)) continue;
    expect(Math.abs(leftEdges.get(row)! - leftEdges.get(mirrorRow)!))
      .toBeLessThanOrEqual(1);
    expect(Math.abs(rightEdges.get(row)! - rightEdges.get(mirrorRow)!))
      .toBeLessThanOrEqual(1);
  }

  const centerRow = Math.round(centerY);
  const centerArc = Array.from(
    { length: 7 },
    (_, index) => rightEdges.get(centerRow - 3 + index)!,
  );
  expect(Math.max(...centerArc) - Math.min(...centerArc)).toBeLessThanOrEqual(1);
  expect(rightEdges.get(centerRow - 10)! - rightEdges.get(centerRow - 3)!)
    .toBeGreaterThanOrEqual(3);
  expect(rightEdges.get(centerRow + 10)! - rightEdges.get(centerRow + 3)!)
    .toBeGreaterThanOrEqual(3);

  const centerThickness = rightEdges.get(centerRow)! - leftEdges.get(centerRow)! + 1;
  expect(centerThickness).toBeGreaterThanOrEqual(6);
  expect(centerThickness).toBeLessThanOrEqual(11);

  const innerArcFit = bestOffsetCircleFit(rightEdges, centerY);
  expect(innerArcFit.samples).toBeGreaterThanOrEqual(17);
  expect(innerArcFit.centerX).toBeGreaterThan(15.5);
  expect(innerArcFit.rmse).toBeLessThanOrEqual(0.85);
}

function bestOffsetCircleFit(
  rightEdges: ReadonlyMap<number, number>,
  centerY: number,
): { centerX: number; rmse: number; samples: number } {
  let best = { centerX: 0, rmse: Number.POSITIVE_INFINITY, samples: 0 };
  for (let arcCenterX = 18; arcCenterX <= 30; arcCenterX += 0.25) {
    for (let arcCenterY = centerY - 1; arcCenterY <= centerY + 1; arcCenterY += 0.25) {
      for (let radius = 9; radius <= 18; radius += 0.25) {
        let squaredError = 0;
        let samples = 0;
        for (let row = Math.ceil(centerY - 10); row <= Math.floor(centerY + 10); row += 1) {
          const actual = rightEdges.get(row);
          const dy = row - arcCenterY;
          if (actual === undefined || Math.abs(dy) >= radius) continue;
          const expected = Math.ceil(
            arcCenterX - Math.sqrt(radius ** 2 - dy ** 2),
          ) - 1;
          squaredError += (actual - expected) ** 2;
          samples += 1;
        }
        if (samples < 17) continue;
        const rmse = Math.sqrt(squaredError / samples);
        if (rmse < best.rmse) best = { centerX: arcCenterX, rmse, samples };
      }
    }
  }
  return best;
}

function cssPx(rule: string, pattern: RegExp): number {
  const match = rule.match(pattern);
  if (match === null) throw new Error(`Missing pixel value ${pattern} in ${rule}`);
  return Number(match[1]);
}

function canvasContext(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D;
}

class StaticApi implements GameApi {
  constructor(protected current: PublicSnapshot) {}

  getSnapshot(): Promise<PublicSnapshot> {
    return Promise.resolve(this.current);
  }

  command(_request: CommandRequest): Promise<CommandResult> {
    return Promise.resolve({ status: 200, snapshot: this.current });
  }
}

class PendingApi extends StaticApi {
  readonly requests: CommandRequest[] = [];

  override command(request: CommandRequest): Promise<CommandResult> {
    this.requests.push(request);
    return new Promise(() => undefined);
  }
}

function snapshot(overrides: Partial<PublicSnapshot> = {}): PublicSnapshot {
  return {
    revision: 7,
    wallet: 5,
    localDate: "2026-08-27",
    lastGrantedLocalDate: "2026-08-27",
    daily: { "2026-08-27": { workCoins: 3 } },
    tokenEnergy: { progress: 1_850, dailyCoins: { "2026-08-27": 3 } },
    pityCount: 1,
    inventory: ["plant"],
    displaySlots: [],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    agentStatus: "idle",
    capabilities: { commands: true },
    ecosystem: createInitialEcosystemState(),
    ...overrides,
  };
}
