/// <reference types="vite/client" />
import userEvent from "@testing-library/user-event";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DshAdapter } from "../dsh/adapter";
import { STATE_KEY, StateRepository } from "../storage/repository";
import { FixedClock } from "../time/clock";
import GLOBAL_STYLE from "../styles/global.css?raw";
import { App, type AppRuntime } from "./App";

const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks");

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("Image", class LoadedImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext());
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalLocksDescriptor === undefined) {
    Reflect.deleteProperty(navigator, "locks");
  } else {
    Object.defineProperty(navigator, "locks", originalLocksDescriptor);
  }
});

describe("App", () => {
  it("keeps only essential status permanent and reveals tools from the slot machine", async () => {
    render(<App />);

    expect(
      screen.getByRole("application", { name: "DSH 桌面老虎机" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("application", { name: "DSH 桌面老虎机" }))
      .toHaveStyle({ "--widget-width": "641px", "--widget-height": "277px" });
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
    expect(screen.getByText(/钱包/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开演示控制台" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开收藏盒" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开工坊" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前目标" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开设置" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "DSH 像素老虎机场景" })).toHaveTextContent(
      "DSH 像素老虎机场景",
    );
    expect(screen.getByRole("region", { name: "老虎机与养成生态" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "养成生态" })).toHaveTextContent("鱼缸 1 / 3");
    const commandBar = screen.getByRole("region", { name: "工作台控制" });
    const ecosystemScene = screen.getByRole("region", { name: "养成生态" });
    expect(ecosystemScene).toContainElement(commandBar);
    expect(commandBar.parentElement).toHaveAttribute("data-layout", "contextual-one-row");
    const ecosystemWidget = screen.getByRole("region", { name: "老虎机与养成生态" });
    expect(ecosystemWidget).toHaveAttribute("data-composition", "single-workbench-v3");
    expect(screen.getByRole("img", { name: "DSH 像素老虎机场景" }))
      .toHaveAttribute("data-scene-layer", "dynamic-equipment");
    expect(ecosystemWidget.firstElementChild).toBe(screen.getByRole("region", { name: "养成生态" }));
    expect(ecosystemWidget.lastElementChild).toHaveAttribute("aria-label", "老虎机微缩场景");

    const toolTrigger = screen.getByRole("button", { name: "打开老虎机工具抽屉" });
    expect(toolTrigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toolTrigger);
    expect(toolTrigger).toHaveAttribute("aria-expanded", "true");
    const collectionCommand = screen.getByRole("button", { name: "打开收藏盒" });
    await userEvent.click(collectionCommand);
    expect(toolTrigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "打开收藏盒" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "收藏盒" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "关闭收藏盒" }));
    expect(screen.queryByRole("dialog", { name: "收藏盒" })).not.toBeInTheDocument();
  });

  it("keeps expanded commands selected and limits press feedback to transform", () => {
    expect(GLOBAL_STYLE).toContain('.pixel-button[aria-expanded="true"]');
    expect(GLOBAL_STYLE).toContain("transition: transform 140ms var(--ease-out);");
    expect(GLOBAL_STYLE).toContain(".pixel-button:active:not(:disabled)");
    expect(GLOBAL_STYLE).toContain("@keyframes dsh-habitat-enter-previous");
    expect(GLOBAL_STYLE).toContain("@keyframes dsh-habitat-enter-next");
    expect(GLOBAL_STYLE).not.toMatch(/@keyframes dsh-habitat-enter-(?:previous|next)\s*\{[^}]*opacity:\s*0/);
    expect(GLOBAL_STYLE).toContain("animation: dsh-care-feedback 520ms var(--ease-out) both;");
    expect(GLOBAL_STYLE).toContain("animation: dsh-care-feedback-pixel 520ms steps(5, end) both;");
  });

  it("uses one essential ribbon and two scene-bound contextual drawers", () => {
    const deck = cssRuleExact(GLOBAL_STYLE, ".ecosystem-scene__command-deck");
    const commandBar = cssRuleExact(GLOBAL_STYLE, ".workbench-command-bar");
    const goal = cssRuleExact(GLOBAL_STYLE, ".current-goal");
    const launchers = cssRuleExact(GLOBAL_STYLE, ".widget-launchers");
    const launcherButton = cssRuleExact(GLOBAL_STYLE, ".widget-launchers .pixel-button");
    const habitatDrawer = cssRuleExact(GLOBAL_STYLE, ".ecosystem-scene__habitat-drawer");
    const slotConsole = cssRuleExact(GLOBAL_STYLE, ".slot-tool-console");
    const switcherTitle = cssRuleExact(GLOBAL_STYLE, ".ecosystem-scene__switcher strong");

    expect(deck).toMatch(/height:\s*42px/);
    expect(deck).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) 196px/);
    expect(deck).toMatch(/border:\s*1px solid #6f5534/);
    expect(deck).toMatch(/padding:\s*3px/);
    expect(deck).toMatch(/background:\s*linear-gradient\(/);
    expect(commandBar).toMatch(/height:\s*100%/);
    expect(commandBar).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(commandBar).toMatch(/border:\s*0/);
    expect(commandBar).toMatch(/box-shadow:\s*none/);
    expect(goal).toMatch(/grid-template-columns:\s*52px 114px minmax\(0,\s*1fr\) 86px/);
    expect(launchers).toMatch(/width:\s*132px/);
    expect(launchers).toMatch(/gap:\s*0/);
    expect(launcherButton).toMatch(/border:\s*0/);
    expect(launcherButton).toMatch(/min-width:\s*0/);
    expect(launcherButton).toMatch(/border-left:\s*1px solid/);
    expect(launcherButton).toMatch(/border-radius:\s*0/);
    expect(habitatDrawer).toMatch(/position:\s*absolute/);
    expect(habitatDrawer).toMatch(/width:\s*276px/);
    expect(slotConsole).toMatch(/position:\s*absolute/);
    expect(slotConsole).toMatch(/top:\s*127px/);
    expect(switcherTitle).toMatch(/min-width:\s*0/);
    expect(switcherTitle).toMatch(/text-overflow:\s*ellipsis/);
  });

  it("uses an independent lighting clock and exposes the current system-light phase", () => {
    const lightingClock = new FixedClock(new Date(2026, 7, 31, 20, 0));
    const { container } = render(<App lightingClock={lightingClock} />);

    const app = screen.getByRole("application", { name: "DSH 桌面老虎机" });
    expect(app).toHaveAttribute("data-day-phase", "night");
    expect(screen.getByRole("status", { name: "当前系统光照：夜间熄灯" }))
      .toHaveTextContent("光照夜间熄灯");
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

    lightingClock.set(new Date(2026, 7, 31, 8, 0));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(app).toHaveAttribute("data-day-phase", "day");
  });

  it("applies phase filters directly to transparent art layers and disables their transitions for reduced motion", () => {
    expect(GLOBAL_STYLE).toContain('.desktop[data-day-phase="dawn"]');
    expect(GLOBAL_STYLE).toContain('.desktop[data-day-phase="day"]');
    expect(GLOBAL_STYLE).toContain('.desktop[data-day-phase="dusk"]');
    expect(GLOBAL_STYLE).toContain('.desktop[data-day-phase="night"]');
    expect(GLOBAL_STYLE).toContain("filter: var(--daylight-scene-filter);");
    expect(GLOBAL_STYLE).toContain(".slot-widget canvas");
    expect(GLOBAL_STYLE).not.toContain(".slot-widget::before");
    expect(GLOBAL_STYLE).toContain(".desktop__night-sky");
    expect(GLOBAL_STYLE).toContain(".ecosystem-scene__night-glow");
    expect(GLOBAL_STYLE).toContain('[data-day-phase="night"] .desktop__night-sky');
    expect(GLOBAL_STYLE).toContain('[data-day-phase="night"] .ecosystem-scene__night-glow');
    expect(GLOBAL_STYLE).toContain("[data-night-moonlight]");
    expect(GLOBAL_STYLE).toContain("[data-night-hotspot]");
    expect(GLOBAL_STYLE).toContain("[data-night-rest]");
    expect(GLOBAL_STYLE).toContain("[data-slot-night-light]");
    expect(GLOBAL_STYLE).toContain("pointer-events: none;");
    expect(GLOBAL_STYLE).toContain("transition: none !important;");
  });

  it("uses soft-edged moonlight without polygon clipping", () => {
    const moonlight = cssRule(GLOBAL_STYLE, ".ecosystem-widget [data-night-moonlight]");

    expect(moonlight).not.toMatch(/clip-path\s*:\s*polygon/i);
  });

  it("renders the detailed 31 by 31 rounded crescent at the compact 63px display size", () => {
    const sky = cssRule(GLOBAL_STYLE, ".desktop__night-sky");
    const moon = cssRule(GLOBAL_STYLE, ".desktop__pixel-moon");

    expect(sky).toMatch(/top:\s*-116px/);
    expect(sky).toMatch(/left:\s*-132px/);
    expect(sky).toMatch(/width:\s*128px/);
    expect(moon).toMatch(/width:\s*63px/);
    expect(moon).toMatch(/height:\s*63px/);
    expect(moon).not.toMatch(/clip-path\s*:\s*polygon/i);
  });

  it("intensifies aquarium and garden washes without changing the pasture baseline", () => {
    const aquarium = cssRule(GLOBAL_STYLE, ".ecosystem-scene__night-glow--aquarium");
    const garden = cssRule(GLOBAL_STYLE, ".ecosystem-scene__night-glow--garden");
    const animals = cssRule(GLOBAL_STYLE, ".ecosystem-scene__night-glow--animals");

    expect(rgbaAlphas(aquarium)[0]).toBeGreaterThanOrEqual(0.34);
    expect(rgbaAlphas(garden)[0]).toBeGreaterThanOrEqual(0.38);
    expect(rgbaAlphas(animals).slice(0, 2)).toEqual([0.3, 0.14]);
  });

  it("raises only aquarium and garden night opacity above the shared pasture baseline", () => {
    const shared = cssRule(
      GLOBAL_STYLE,
      '.desktop[data-day-phase="night"] .ecosystem-scene__night-glow',
    );
    const aquarium = cssRule(
      GLOBAL_STYLE,
      '.desktop[data-day-phase="night"] .ecosystem-scene__night-glow--aquarium',
    );
    const garden = cssRule(
      GLOBAL_STYLE,
      '.desktop[data-day-phase="night"] .ecosystem-scene__night-glow--garden',
    );

    expect(cssNumericProperty(shared, "opacity")).toBeCloseTo(0.74);
    expect(cssNumericProperty(aquarium, "opacity")).toBeGreaterThanOrEqual(0.88);
    expect(cssNumericProperty(garden, "opacity")).toBeGreaterThanOrEqual(0.88);
  });

  it("lights the whole slot cabinet without drawing glass-panel borders", () => {
    for (const light of ["cabinet", "reels", "control-panel"] as const) {
      const nightRule = cssRule(
        GLOBAL_STYLE,
        `.desktop[data-day-phase="night"] .slot-night-light--${light}`,
      );
      expect(cssNumericProperty(nightRule, "opacity")).toBeGreaterThanOrEqual(0.88);
    }

    const cabinet = cssRuleExact(GLOBAL_STYLE, ".slot-night-light--cabinet");
    expectNoVisiblePanelChrome(cabinet);
    expect(cssDeclaration(cabinet, "background").match(/radial-gradient/gi)?.length ?? 0)
      .toBeGreaterThanOrEqual(2);
  });

  it("keeps reel and control reflections subtle and free of glowing outlines", () => {
    for (const light of ["reels", "control-panel"] as const) {
      const rule = cssRuleExact(GLOBAL_STYLE, `.slot-night-light--${light}`);
      expectNoVisiblePanelChrome(rule);
      const reflectionAlphas = rgbaAlphas(cssDeclaration(rule, "background"));
      expect(reflectionAlphas.length).toBeGreaterThan(0);
      expect(Math.max(...reflectionAlphas)).toBeLessThanOrEqual(0.22);
    }
  });

  it("brightens the slot canvas as one warm cabinet at night", () => {
    const rule = cssRule(
      GLOBAL_STYLE,
      '.desktop[data-day-phase="night"] .slot-widget canvas',
    );
    const filter = cssDeclaration(rule, "filter");

    expect(cssFunctionNumber(filter, "brightness")).toBeGreaterThanOrEqual(0.64);
    expect(filter).toMatch(/(?:saturate|drop-shadow)\(/i);
  });

  it("keeps broad habitat lighting steady and freezes the wick for reduced motion", () => {
    const broadGlow = cssRule(
      GLOBAL_STYLE,
      '.desktop[data-day-phase="night"] .ecosystem-scene__night-glow',
    );
    const wick = cssRule(
      GLOBAL_STYLE,
      '.desktop[data-day-phase="night"] .ecosystem-scene__night-hotspot',
    );
    const reducedMotion = GLOBAL_STYLE.slice(GLOBAL_STYLE.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(broadGlow).not.toMatch(/animation\s*:/i);
    expect(wick).toMatch(/animation\s*:/i);
    expect(reducedMotion).toMatch(
      /\.ecosystem-scene__night-hotspot,[\s\S]*?\{[^}]*animation:\s*none\s*!important;/,
    );
  });

  it("changes the pasture from an active day routine to a visible resting night routine", async () => {
    const lightingClock = new FixedClock(new Date(2026, 7, 31, 20, 0));
    const { container } = render(<App lightingClock={lightingClock} />);

    await userEvent.click(screen.getByRole("button", { name: "上一处养成场景" }));
    const pasture = () => container.querySelector('.ecosystem-scene__habitat-stage[data-habitat="animals"]');
    expect(pasture()?.querySelector('[data-resident-id]')).not.toBeInTheDocument();
    expect(pasture()?.querySelector('[data-night-rest="animals"]'))
      .toHaveAttribute("data-routine-state", "resting");

    lightingClock.set(new Date(2026, 7, 31, 9, 0));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(pasture()?.querySelector('[data-night-rest="animals"]')).not.toBeInTheDocument();
    expect(pasture()?.querySelector('[data-resident-id="chick"]'))
      .toHaveAttribute("data-routine-state", "active");

    await userEvent.click(screen.getByRole("button", { name: "与小鸡互动" }));
    expect(screen.getByText("小鸡开心地跑来啄了啄")).toBeVisible();
  });

  it("routes the development result selector to the next paid spin", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (
          _name: string,
          _options: { mode: "exclusive"; ifAvailable: true },
          callback: (lock: object | null) => Promise<void> | void,
        ) => callback({}),
      },
    });
    render(<App />);

    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("3"));
    await userEvent.click(screen.getByRole("button", { name: "打开演示控制台" }));
    await userEvent.selectOptions(screen.getByLabelText("预设下次结果"), "common");
    const lever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    await waitFor(() => expect(lever).toBeEnabled());
    await userEvent.click(lever);

    const rawState = localStorage.getItem(STATE_KEY);
    expect(rawState).not.toBeNull();
    expect(JSON.parse(rawState!)).toMatchObject({
      wallet: 2,
      activeSpin: {
        reels: ["leaf", "leaf", "leaf"],
        reward: { kind: "collectible", collectibleId: "plant" },
      },
    });
  });

  it("composes the core app with a subscribe-only DSH adapter", () => {
    const subscribe = vi.fn<DshAdapter["subscribe"]>(() => () => undefined);
    const adapter: DshAdapter = { subscribe };
    const runtime = {
      repository: new StateRepository(localStorage),
      clock: new FixedClock(new Date("2026-08-26T08:00:00.000Z")),
      adapter,
      createId: () => "real-adapter-spin",
    } satisfies AppRuntime;

    render(<App createRuntime={() => runtime} />);

    expect(subscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole("application", { name: "DSH 桌面老虎机" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开演示控制台" })).not.toBeInTheDocument();
  });

  it("guides a readonly development tab to the isolated test sandbox", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (
          _name: string,
          _options: { mode: "exclusive"; ifAvailable: true },
          callback: (lock: object | null) => Promise<void> | void,
        ) => callback(null),
      },
    });

    render(<App />);

    const notice = await screen.findByRole("status", { name: "只读测试提示" });
    expect(notice).toHaveTextContent("当前页是只读副本");
    expect(screen.getByRole("link", { name: "打开独立测试沙盒" }))
      .toHaveAttribute("href", "/native-preview.html");
    await userEvent.click(screen.getByRole("button", { name: "打开鱼缸养成抽屉" }));
    expect(screen.getByRole("button", { name: "投喂鱼缸" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拉下右侧摇杆" })).toBeDisabled();
  });

  it("holds one asynchronous writer lease and releases it during cleanup", async () => {
    let released = false;
    const request = vi.fn(async (
      _name: string,
      _options: { mode: "exclusive"; ifAvailable: true },
      callback: (lock: object | null) => Promise<void> | void,
    ) => {
      await callback({});
      released = true;
    });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });

    const { unmount, rerender } = render(<StrictMode><App /></StrictMode>);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "拉下右侧摇杆" })).toBeEnabled();
    });

    rerender(<StrictMode><App /></StrictMode>);
    expect(request).toHaveBeenCalledOnce();
    unmount();

    await waitFor(() => expect(released).toBe(true));
  });
});

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

function cssRule(style: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = style.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (match === null) throw new Error(`Missing CSS rule ${selector}`);
  return match[1];
}

function cssRuleExact(style: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = style.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  if (match === null) throw new Error(`Missing exact CSS rule ${selector}`);
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
