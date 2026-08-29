import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as sfx from "../audio/sfx";
import { TABLE_POSITION_BY_ID } from "../domain/table-positions";
import {
  createInitialState,
  type GameState,
  type ResolvedReward,
  type ResolvedSpin,
} from "../domain/types";
import { collectiblePlacementRect, type SceneAssets } from "../game/renderer/assets";
import { GameCanvas } from "./GameCanvas";

function dragEvent(type: "dragover" | "drop", dataTransfer: object): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 47, clientY: 212 });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
}

const neverLoads = () => new Promise<SceneAssets>(() => undefined);
const READY_ASSETS: SceneAssets = {
  scene: { kind: "scene" } as unknown as HTMLImageElement,
  reels: { kind: "reels" } as unknown as HTMLImageElement,
  collectibles: { kind: "collectibles" } as unknown as HTMLImageElement,
};
const loadsReady = () => Promise.resolve(READY_ASSETS);
const PAYOUT_REWARD_CASES: ReadonlyArray<readonly [string, ResolvedReward, boolean]> = [
  ["none", { kind: "none" }, false],
  ["coin reward", { kind: "coins", amount: 5, reason: "five-coins" }, true],
  ["new collectible only", {
    kind: "collectible",
    collectibleId: "plant",
    isDuplicate: false,
    conversionCoins: 0,
    bonusCoins: 0,
  }, false],
  ["duplicate conversion and bonus", {
    kind: "collectible",
    collectibleId: "plant",
    isDuplicate: true,
    conversionCoins: 3,
    bonusCoins: 3,
  }, true],
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stateWithSpin(stage: ResolvedSpin["stage"], reducedMotion = false): GameState {
  const state = createInitialState();
  state.wallet = 1;
  state.settings.reducedMotion = reducedMotion;
  state.activeSpin = {
    id: "spin-1",
    stage,
    reels: ["coin", "coin", "coin"],
    reward: { kind: "coins", amount: 5, reason: "five-coins" },
    pityAfter: 0,
    createdAt: "2026-08-26T00:00:00.000Z",
  };
  return state;
}

describe("GameCanvas", () => {
  it("uses the right-hand lever as the only spin control from an idle wallet", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(recordingContext());
    const onPlay = vi.fn();
    const state = createInitialState();
    state.wallet = 2;

    render(
      <GameCanvas
        state={state}
        mode="writer"
        onPlay={onPlay}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );

    expect(screen.queryByRole("button", { name: "投入 1 枚硬币" })).not.toBeInTheDocument();
    const lever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    await waitFor(() => expect(lever).toBeEnabled());
    await userEvent.click(lever);
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("marks the canvas ready only after it synchronously renders the elapsed-zero frame", async () => {
    const drawImage = vi.fn();
    const context = recordingContext(drawImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    const assets = {
      scene: { kind: "scene" } as unknown as HTMLImageElement,
      reels: { kind: "reels" } as unknown as HTMLImageElement,
      collectibles: { kind: "collectibles" } as unknown as HTMLImageElement,
    };

    render(
      <GameCanvas
        state={stateWithSpin("spinning")}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={() => Promise.resolve(assets)}
      />,
    );

    const canvas = screen.getByRole("img", { name: "DSH 像素老虎机场景" });
    expect(canvas).not.toHaveAttribute("data-render-state", "ready");
    await act(async () => Promise.resolve());
    expect(drawImage).toHaveBeenCalledWith(assets.scene, 0, 0);
    expect(canvas).toHaveAttribute("data-render-state", "ready");
  });

  it.each([
    ["loading", neverLoads, false],
    ["failed", () => Promise.reject(new Error("asset failure")), true],
  ] as const)(
    "disables lever side effects while assets are %s",
    async (_label, loadAssets, waitForFailure) => {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
      const onInsertCoin = vi.fn();
      const onPullLever = vi.fn();
      const state = createInitialState();
      state.wallet = 1;
      const { rerender } = render(
        <GameCanvas
          state={state}
          mode="writer"
          onInsertCoin={onInsertCoin}
          onPullLever={onPullLever}
          onAnimationEvent={() => undefined}
          loadAssets={loadAssets}
        />,
      );
      if (waitForFailure) await screen.findByRole("alert");

      rerender(
        <GameCanvas
          state={stateWithSpin("coin-inserted")}
          mode="writer"
          onInsertCoin={onInsertCoin}
          onPullLever={onPullLever}
          onAnimationEvent={() => undefined}
          loadAssets={loadAssets}
        />,
      );
      const lever = screen.getByRole("button", { name: "拉下右侧摇杆" });
      expect(lever).toBeDisabled();
      fireEvent.pointerDown(lever, { pointerId: 7, clientY: 10 });
      fireEvent.pointerMove(lever, { pointerId: 7, clientY: 40 });
      fireEvent.pointerUp(lever, { pointerId: 7, clientY: 40 });
      fireEvent.click(lever);
      expect(onInsertCoin).not.toHaveBeenCalled();
      expect(onPullLever).not.toHaveBeenCalled();
    },
  );

  it("exposes a stable accessibility marker for every displayed collectible", () => {
    const state = createInitialState();
    state.displayedCollectibles = ["plant", "crystal"];

    render(
      <GameCanvas
        state={state}
        mode="unsupported"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );

    expect(screen.getByTestId("displayed-plant")).toHaveTextContent("小盆栽");
    expect(screen.getByTestId("displayed-crystal")).toHaveTextContent("发光水晶");
    expect(screen.queryByTestId("displayed-moon-lamp")).not.toBeInTheDocument();
  });

  it("magnetically previews and drops a dragged collectible on the nearest tabletop anchor", async () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant"];
    const onSetPlacement = vi.fn();
    render(
      <GameCanvas
        state={state}
        mode="writer"
        onSetPlacement={onSetPlacement}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );

    const surface = screen.getByTestId("table-drop-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 384, bottom: 288, width: 384, height: 288,
      toJSON: () => ({}),
    });
    const transfer = {
      getData: () => "plant",
      setData: () => undefined,
      dropEffect: "move",
      effectAllowed: "move",
    };
    fireEvent(surface, dragEvent("dragover", transfer));
    await waitFor(() => expect(screen.getByTestId("table-position-left-front-round"))
      .toHaveAttribute("data-snap", "true"));
    fireEvent(surface, dragEvent("drop", transfer));
    expect(onSetPlacement).toHaveBeenCalledWith("plant", "left-front-round");
  });

  it("keeps the placed-item drag target on the same visible sprite rectangle as the renderer", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["desk-clock"];
    state.tablePlacements = [{ itemId: "desk-clock", positionId: "right-middle-small" }];
    render(
      <GameCanvas
        state={state}
        mode="writer"
        onSetPlacement={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );

    const expected = collectiblePlacementRect(
      "desk-clock",
      TABLE_POSITION_BY_ID["right-middle-small"],
    );
    const handle = screen.getByRole("button", { name: "拖动桌面上的 桌面时钟" });
    expect(Number.parseFloat(handle.style.left)).toBeCloseTo(expected.x, 2);
    expect(Number.parseFloat(handle.style.top)).toBeCloseTo(expected.y, 2);
    expect(Number.parseFloat(handle.style.width)).toBeCloseTo(expected.size, 2);
    expect(Number.parseFloat(handle.style.height)).toBeCloseTo(expected.size, 2);
  });

  it("exposes the lever as the single native keyboard-operable spin button", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(recordingContext());
    const user = userEvent.setup();
    const onInsertCoin = vi.fn();
    const onPullLever = vi.fn();
    const state = createInitialState();
    state.wallet = 1;
    const { rerender } = render(
      <GameCanvas
        state={state}
        mode="writer"
        onInsertCoin={onInsertCoin}
        onPullLever={onPullLever}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );

    const idleLever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    await waitFor(() => expect(idleLever).toBeEnabled());
    await user.click(idleLever);
    expect(onInsertCoin).toHaveBeenCalledOnce();

    rerender(
      <GameCanvas
        state={stateWithSpin("coin-inserted")}
        mode="writer"
        onInsertCoin={onInsertCoin}
        onPullLever={onPullLever}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );
    const lever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    lever.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onPullLever).toHaveBeenCalledTimes(2);
  });

  it("fires one lever pull for a downward drag of 24 CSS pixels and suppresses its click", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(recordingContext());
    const onPullLever = vi.fn();
    render(
      <GameCanvas
        state={stateWithSpin("coin-inserted")}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={onPullLever}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );
    const lever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    await waitFor(() => expect(lever).toBeEnabled());

    fireEvent.pointerDown(lever, { pointerId: 7, clientY: 10 });
    fireEvent.pointerMove(lever, { pointerId: 7, clientY: 34 });
    fireEvent.pointerUp(lever, { pointerId: 7, clientY: 34 });
    fireEvent.click(lever);

    expect(onPullLever).toHaveBeenCalledOnce();
  });

  it("does not suppress the first normal lever click of the next spin when no drag click fires", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(recordingContext());
    const onPullLever = vi.fn();
    const firstSpin = stateWithSpin("coin-inserted");
    const { rerender } = render(
      <GameCanvas
        state={firstSpin}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={onPullLever}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );
    const firstLever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    await waitFor(() => expect(firstLever).toBeEnabled());

    fireEvent.pointerDown(firstLever, { pointerId: 7, clientY: 10 });
    fireEvent.pointerMove(firstLever, { pointerId: 7, clientY: 34 });
    fireEvent.pointerUp(firstLever, { pointerId: 7, clientY: 34 });
    expect(onPullLever).toHaveBeenCalledOnce();

    const secondSpin = stateWithSpin("coin-inserted");
    secondSpin.activeSpin = { ...secondSpin.activeSpin!, id: "spin-2" };
    rerender(
      <GameCanvas
        state={secondSpin}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={onPullLever}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "拉下右侧摇杆" }));

    expect(onPullLever).toHaveBeenCalledTimes(2);
  });

  it("disables economic controls for invalid state or non-writer modes", () => {
    const state = createInitialState();
    const { rerender } = render(
      <GameCanvas
        state={state}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );
    expect(screen.getByRole("button", { name: "拉下右侧摇杆" })).toBeDisabled();

    state.wallet = 2;
    rerender(
      <GameCanvas
        state={state}
        mode="readonly"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );
    expect(screen.getByRole("button", { name: "拉下右侧摇杆" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("只读");
  });

  it("treats the manual reduced-motion preference as sound disabled", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(recordingContext());
    const state = createInitialState();
    state.wallet = 1;
    state.settings.muted = false;
    state.settings.reducedMotion = true;
    const play = vi.spyOn(sfx, "playSfx").mockImplementation(() => undefined);
    render(
      <GameCanvas
        state={state}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={loadsReady}
      />,
    );

    const lever = screen.getByRole("button", { name: "拉下右侧摇杆" });
    await waitFor(() => expect(lever).toBeEnabled());
    await userEvent.click(lever);

    expect(play).toHaveBeenCalledWith("lever", true);
  });

  it("keeps disabled controls and a live warning available when image assets fail", async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const state = createInitialState();
    state.wallet = 1;
    render(
      <GameCanvas
        state={state}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={() => Promise.reject(new Error("asset failure"))}
      />,
    );

    expect(await screen.findByText("像素资源加载失败；经济操作已暂停")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拉下右侧摇杆" })).toBeDisabled();
    expect(getContext).toHaveBeenCalled();
  });

  it("ignores a successful asset load that resolves after unmount", async () => {
    let resolveAssets!: (assets: SceneAssets) => void;
    const deferred = new Promise<SceneAssets>((resolve) => {
      resolveAssets = resolve;
    });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { unmount } = render(
      <GameCanvas
        state={createInitialState()}
        mode="unsupported"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={() => deferred}
      />,
    );

    unmount();
    await act(async () => {
      resolveAssets({
        scene: {} as HTMLImageElement,
        reels: {} as HTMLImageElement,
        collectibles: {} as HTMLImageElement,
      });
      await Promise.resolve();
    });

    expect(getContext).not.toHaveBeenCalled();
  });

  it("announces storage failures through the shared live status", () => {
    const state = createInitialState();
    state.wallet = 1;
    render(
      <GameCanvas
        state={state}
        mode="writer"
        error="无法写入存档；经济操作已暂停。"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("无法写入存档；经济操作已暂停。");
  });

  it("keeps the settled reward announcement after the spin is cleared", async () => {
    const settled = stateWithSpin("settled");
    const { rerender } = render(
      <GameCanvas
        state={settled}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("获得 5 枚硬币");

    const cleared = createInitialState();
    cleared.wallet = 5;
    rerender(
      <GameCanvas
        state={cleared}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("获得 5 枚硬币");
  });

  it("emits each requestAnimationFrame phase boundary once at its exact duration", () => {
    const raf = installRaf();
    const onAnimationEvent = vi.fn();
    const { rerender } = render(
      <GameCanvas
        state={stateWithSpin("spinning")}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={neverLoads}
      />,
    );

    act(() => raf.step(1_000));
    act(() => raf.step(3_399));
    expect(onAnimationEvent).not.toHaveBeenCalled();
    act(() => raf.step(3_400));
    act(() => raf.step(4_000));
    expect(onAnimationEvent.mock.calls).toEqual([["SPIN_ANIMATION_DONE"]]);

    rerender(
      <GameCanvas
        state={stateWithSpin("highlight")}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={neverLoads}
      />,
    );
    act(() => raf.step(5_000));
    act(() => raf.step(5_479));
    expect(onAnimationEvent).toHaveBeenCalledTimes(1);
    act(() => raf.step(5_480));

    rerender(
      <GameCanvas
        state={stateWithSpin("payout")}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={neverLoads}
      />,
    );
    act(() => raf.step(6_000));
    act(() => raf.step(6_999));
    expect(onAnimationEvent).toHaveBeenCalledTimes(2);
    act(() => raf.step(7_000));

    rerender(
      <GameCanvas
        state={stateWithSpin("settled")}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={neverLoads}
      />,
    );
    act(() => raf.step(8_000));
    act(() => raf.step(8_100));

    expect(onAnimationEvent.mock.calls).toEqual([
      ["SPIN_ANIMATION_DONE"],
      ["HIGHLIGHT_DONE"],
      ["PAYOUT_DONE"],
      ["CLEAR_SETTLED_SPIN"],
    ]);
  });

  it("restarts a changed agent reaction without restarting or duplicating the spin phase", async () => {
    const raf = installRaf();
    const onAnimationEvent = vi.fn();
    const fillRect = vi.fn();
    const context = recordingContext(vi.fn(), fillRect);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const assets = {
      scene: {} as HTMLImageElement,
      reels: {} as HTMLImageElement,
      collectibles: {} as HTMLImageElement,
    };
    const loadAssets = () => Promise.resolve(assets);
    const idleStatus = stateWithSpin("spinning");
    idleStatus.displayedCollectibles = ["plant"];
    const { rerender } = render(
      <GameCanvas
        state={idleStatus}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={loadAssets}
      />,
    );
    await act(async () => Promise.resolve());

    act(() => raf.step(1_000));
    act(() => raf.step(3_399));
    expect(onAnimationEvent).not.toHaveBeenCalled();

    const completedStatus = structuredClone(idleStatus);
    completedStatus.agentStatus = "completed";
    rerender(
      <GameCanvas
        state={completedStatus}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={loadAssets}
      />,
    );
    fillRect.mockClear();
    act(() => raf.step(3_400));
    act(() => raf.step(3_600));

    expect(fillRect).toHaveBeenCalledWith(47, 92, 3, 1);
    expect(onAnimationEvent.mock.calls).toEqual([["SPIN_ANIMATION_DONE"]]);
  });

  it("preserves phase order under reduced motion and cancels pending frames on unmount", () => {
    const raf = installRaf();
    const onAnimationEvent = vi.fn();
    const { unmount } = render(
      <GameCanvas
        state={stateWithSpin("spinning", true)}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={neverLoads}
      />,
    );

    act(() => raf.step(500));
    act(() => raf.step(700));
    expect(onAnimationEvent).toHaveBeenCalledOnce();
    expect(onAnimationEvent).toHaveBeenCalledWith("SPIN_ANIMATION_DONE");

    unmount();
    expect(raf.cancel).toHaveBeenCalled();
  });

  it("uses the live system reduced-motion preference for direct phase completion", () => {
    const raf = installRaf();
    const onAnimationEvent = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const state = stateWithSpin("spinning");
    state.settings.reducedMotion = false;
    render(
      <GameCanvas
        state={state}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={onAnimationEvent}
        loadAssets={neverLoads}
      />,
    );

    act(() => raf.step(500));

    expect(onAnimationEvent).toHaveBeenCalledOnce();
    expect(onAnimationEvent).toHaveBeenCalledWith("SPIN_ANIMATION_DONE");
  });

  it("cancels its timeout fallback even when cancelAnimationFrame exists", () => {
    const setTimeout = vi.fn(() => 73);
    const clearTimeout = vi.fn();
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    vi.stubGlobal("setTimeout", setTimeout);
    vi.stubGlobal("clearTimeout", clearTimeout);

    const { unmount } = render(
      <GameCanvas
        state={createInitialState()}
        mode="unsupported"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={neverLoads}
      />,
    );
    unmount();

    expect(clearTimeout).toHaveBeenCalledWith(73);
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it("does not reveal a locked collectible before the payout stage", async () => {
    const raf = installRaf();
    const drawImage = vi.fn();
    const context = recordingContext(drawImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const assets = {
      scene: { kind: "scene" } as unknown as HTMLImageElement,
      reels: { kind: "reels" } as unknown as HTMLImageElement,
      collectibles: { kind: "collectibles" } as unknown as HTMLImageElement,
    };
    const state = stateWithSpin("highlight");
    state.activeSpin!.reward = {
      kind: "collectible",
      collectibleId: "plant",
      isDuplicate: false,
      conversionCoins: 0,
      bonusCoins: 0,
    };
    render(
      <GameCanvas
        state={state}
        mode="writer"
        onInsertCoin={() => undefined}
        onPullLever={() => undefined}
        onAnimationEvent={() => undefined}
        loadAssets={() => Promise.resolve(assets)}
      />,
    );
    await act(async () => Promise.resolve());
    act(() => raf.step(100));

    expect(drawImage.mock.calls.some(([image]) => image === assets.collectibles)).toBe(false);
  });

  it.each(PAYOUT_REWARD_CASES)(
    "wires %s payout value to the canvas coin particles",
    async (_label, reward, expectedCoins) => {
      const raf = installRaf();
      const fillRect = vi.fn();
      const context = recordingContext(vi.fn(), fillRect);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
      const assets = {
        scene: {} as HTMLImageElement,
        reels: {} as HTMLImageElement,
        collectibles: {} as HTMLImageElement,
      };
      const state = stateWithSpin("payout");
      state.activeSpin!.reward = reward;
      render(
        <GameCanvas
          state={state}
          mode="writer"
          onInsertCoin={() => undefined}
          onPullLever={() => undefined}
          onAnimationEvent={() => undefined}
          loadAssets={() => Promise.resolve(assets)}
        />,
      );
      await act(async () => Promise.resolve());

      act(() => raf.step(1_000));

      expect(fillRect.mock.calls.some((call) => (
        call[0] === 216 && call[1] === 202 && call[2] === 2 && call[3] === 2
      ))).toBe(expectedCoins);
    },
  );
});

function installRaf() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => callbacks.delete(id));
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return {
    cancel,
    step(timestamp: number) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) callback(timestamp);
    },
  };
}

function recordingContext(
  drawImage: ReturnType<typeof vi.fn> = vi.fn(),
  fillRect: ReturnType<typeof vi.fn> = vi.fn(),
): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    fillStyle: "",
    clearRect: vi.fn(),
    drawImage,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect,
  } as unknown as CanvasRenderingContext2D;
}
