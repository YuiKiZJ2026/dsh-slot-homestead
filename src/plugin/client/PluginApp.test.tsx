import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SceneAssets, SceneAssetUrls } from "../../game/renderer/assets";
import type { CommandRequest, CommandResult, PublicSnapshot } from "../shared/contracts";
import type { GameApi } from "./api";
import { normalizeCompanionScale, PluginApp } from "./PluginApp";
import { PLUGIN_STYLE } from "./style";

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

  it("uses the slot scene as the native drag surface and renders a text-free collapsed tab", async () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(336);
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
    expect(PLUGIN_STYLE).toContain("@media (max-width: 60px), (max-height: 60px)");
    expect(PLUGIN_STYLE).toContain("> :not(.edge-reveal-tab) { display: none !important;");
    expect(container.querySelectorAll(".companion-resize-grip")).toHaveLength(4);
    const surface = container.querySelector<HTMLElement>(".companion-scale-surface");
    expect(surface).not.toBeNull();
    expect(surface).toContainElement(screen.getByRole("region", { name: "Host 游戏状态" }));
    expect(surface).toContainElement(container.querySelector("canvas"));
    expect(container.querySelector<HTMLElement>(".desktop--companion")?.style.getPropertyValue("--companion-scale"))
      .toBe("1");
    expect(PLUGIN_STYLE).toContain("transform: scale(var(--companion-scale))");
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
    await user.click(screen.getByRole("button", { name: "打开收藏盒" }));
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
    ...overrides,
  };
}
