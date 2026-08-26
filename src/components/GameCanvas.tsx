import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { playSfx } from "../audio/sfx";
import { CATALOG_BY_ID } from "../domain/catalog";
import type { AgentStatus, GameState, ResolvedSpin } from "../domain/types";
import {
  animationFrameFor,
  type AnimationInput,
  type SceneViewModel,
} from "../game/renderer/animation";
import { loadSceneAssets, type SceneAssets } from "../game/renderer/assets";
import { SceneRenderer } from "../game/renderer/scene-renderer";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type AnimationBoundaryEvent =
  | "SPIN_ANIMATION_DONE"
  | "HIGHLIGHT_DONE"
  | "PAYOUT_DONE"
  | "CLEAR_SETTLED_SPIN";

export interface GameCanvasProps {
  state: GameState;
  mode: "writer" | "readonly" | "unsupported";
  error?: string | null;
  onInsertCoin(): void;
  onPullLever(): void;
  onAnimationEvent(event: AnimationBoundaryEvent): void;
  loadAssets?: () => Promise<SceneAssets>;
}

type AssetState = "loading" | "ready" | "failed";

interface DragState {
  pointerId: number;
  startY: number;
  triggered: boolean;
}

interface ScheduledFrame {
  id: number;
  kind: "animation-frame" | "timeout";
}

interface AgentTimeline {
  status: AgentStatus;
  startedAt: number | null;
}

const PHASE_EVENTS: Readonly<Partial<Record<ResolvedSpin["stage"], AnimationBoundaryEvent>>> = {
  spinning: "SPIN_ANIMATION_DONE",
  highlight: "HIGHLIGHT_DONE",
  payout: "PAYOUT_DONE",
  settled: "CLEAR_SETTLED_SPIN",
};

const IDLE_REELS = ["coin", "leaf", "moon"] as const;

export function GameCanvas({
  state,
  mode,
  error = null,
  onInsertCoin,
  onPullLever,
  onAnimationEvent,
  loadAssets = loadSceneAssets,
}: GameCanvasProps) {
  const systemReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const fallbackContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const assetStateRef = useRef<AssetState>("loading");
  const [assetState, setAssetState] = useState<AssetState>("loading");
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [rewardAnnouncement, setRewardAnnouncement] = useState("");
  const onAnimationEventRef = useRef(onAnimationEvent);
  const animationInputRef = useRef<AnimationInput>(animationInputFor(state, systemReducedMotion));
  const agentTimelineRef = useRef<AgentTimeline>({
    status: state.agentStatus ?? "idle",
    startedAt: null,
  });
  const soundDisabledRef = useRef(soundDisabled(state));

  onAnimationEventRef.current = onAnimationEvent;
  animationInputRef.current = animationInputFor(state, systemReducedMotion);
  soundDisabledRef.current = soundDisabled(state);

  useEffect(() => {
    let current = true;
    rendererRef.current = null;
    fallbackContextRef.current = null;
    assetStateRef.current = "loading";
    setAssetState("loading");

    void Promise.resolve()
      .then(loadAssets)
      .then((assets) => {
        if (!current) return;
        const context = getCanvasContext(canvasRef.current);
        if (context === null) throw new Error("canvas context unavailable");
        const renderer = new SceneRenderer(context, assets);
        rendererRef.current = renderer;
        const input = animationInputRef.current;
        renderer.render(animationFrameFor({ ...input, elapsedMs: 0, agentElapsedMs: 0 }));
        assetStateRef.current = "ready";
        setAssetState("ready");
      })
      .catch(() => {
        if (!current) return;
        const context = getCanvasContext(canvasRef.current);
        fallbackContextRef.current = context;
        if (context !== null) drawFallbackScene(context, 0);
        assetStateRef.current = "failed";
        setAssetState("failed");
      });

    return () => {
      current = false;
    };
  }, [loadAssets]);

  const spinKey = state.activeSpin === null
    ? "idle"
    : `${state.activeSpin.id}:${state.activeSpin.stage}`;
  const spinId = state.activeSpin?.id ?? null;
  const settledRewardMessage = rewardMessageFor(state.activeSpin);

  useEffect(() => {
    suppressClickRef.current = false;
  }, [spinId]);

  useEffect(() => {
    if (settledRewardMessage !== "") {
      setRewardAnnouncement(settledRewardMessage);
    }
  }, [settledRewardMessage]);

  useEffect(() => {
    let active = true;
    let scheduledFrame: ScheduledFrame | null = null;
    let startedAt: number | null = null;
    let boundaryEmitted = false;
    let previousStops: readonly [boolean, boolean, boolean] = [false, false, false];
    let stageCuePlayed = false;
    const stage = state.activeSpin?.stage ?? null;
    const phaseEvent = stage === null ? undefined : PHASE_EVENTS[stage];

    const renderFrame = (timestamp: number): void => {
      if (!active) return;
      startedAt ??= timestamp;
      const input = animationInputRef.current;
      const agentTimeline = agentTimelineRef.current;
      if (agentTimeline.status !== input.agentStatus) {
        agentTimeline.status = input.agentStatus;
        agentTimeline.startedAt = timestamp;
      }
      agentTimeline.startedAt ??= timestamp;
      const viewModel = animationFrameFor({
        ...input,
        elapsedMs: Math.max(0, timestamp - startedAt),
        agentElapsedMs: Math.max(0, timestamp - agentTimeline.startedAt),
      });

      rendererRef.current?.render(viewModel);
      if (assetStateRef.current === "failed" && fallbackContextRef.current !== null) {
        drawFallbackScene(fallbackContextRef.current, viewModel.leverProgress);
      }

      if (!stageCuePlayed) {
        playStageCue(stage, state.activeSpin, soundDisabledRef.current);
        stageCuePlayed = true;
      }
      if (stage === "spinning") {
        for (let index = 0; index < viewModel.reelStopped.length; index += 1) {
          if (viewModel.reelStopped[index] && !previousStops[index]) {
            playSfx("reel-stop", soundDisabledRef.current);
          }
        }
      }
      previousStops = viewModel.reelStopped;

      if (phaseEvent !== undefined && viewModel.complete && !boundaryEmitted) {
        boundaryEmitted = true;
        onAnimationEventRef.current(phaseEvent);
        return;
      }

      scheduledFrame = scheduleFrame(renderFrame);
    };

    scheduledFrame = scheduleFrame(renderFrame);
    return () => {
      active = false;
      if (scheduledFrame !== null) cancelScheduledFrame(scheduledFrame);
    };
  }, [spinKey]);

  const assetsReady = assetState === "ready";
  const canInsert = assetsReady && mode === "writer" &&
    state.wallet > 0 && state.activeSpin === null;
  const canPull = assetsReady && mode === "writer" &&
    state.activeSpin?.stage === "coin-inserted";
  const liveMessage = statusMessage(
    state,
    mode,
    error,
    settledRewardMessage || rewardAnnouncement,
  );

  const pullLever = (): void => {
    if (!canPull) return;
    setRewardAnnouncement("");
    playSfx("lever", soundDisabled(state));
    onPullLever();
  };

  const handleLeverPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!canPull) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      triggered: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in test DOMs and older touch implementations.
    }
  };

  const handleLeverPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId || drag.triggered) return;
    if (event.clientY - drag.startY < 24) return;
    event.preventDefault();
    drag.triggered = true;
    suppressClickRef.current = true;
    pullLever();
  };

  const finishLeverPointer = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // See setPointerCapture guard above.
    }
  };

  return (
    <div className="game-canvas-wrap">
      <canvas
        ref={canvasRef}
        width={384}
        height={288}
        role="img"
        aria-label="DSH 像素老虎机场景"
        data-render-state={assetState}
      >
        DSH 像素老虎机场景
      </canvas>
      {state.displayedCollectibles.map((id) => (
        <span
          className="visually-hidden"
          data-testid={`displayed-${id}`}
          key={id}
        >
          已展示收藏品：{CATALOG_BY_ID[id]?.name ?? id}
        </span>
      ))}
      <button
        type="button"
        className="scene-control scene-control--coin"
        aria-label="投入 1 枚硬币"
        aria-describedby="game-status"
        disabled={!canInsert}
        onClick={() => {
          if (!canInsert) return;
          setRewardAnnouncement("");
          playSfx("coin", soundDisabled(state));
          onInsertCoin();
        }}
      />
      <button
        type="button"
        className="scene-control scene-control--lever"
        aria-label="拉动老虎机摇杆"
        aria-describedby="game-status"
        disabled={!canPull}
        onPointerDown={handleLeverPointerDown}
        onPointerMove={handleLeverPointerMove}
        onPointerUp={finishLeverPointer}
        onPointerCancel={finishLeverPointer}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          pullLever();
        }}
      />
      {assetState === "failed" ? (
        <p className="asset-warning" role="alert">像素资源加载失败；经济操作已暂停</p>
      ) : null}
      <p id="game-status" className="visually-hidden" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </div>
  );
}

function animationInputFor(state: GameState, systemReducedMotion: boolean): AnimationInput {
  const spin = state.activeSpin;
  return {
    stage: spin?.stage ?? "settled",
    spinId: spin?.id ?? null,
    elapsedMs: 0,
    agentElapsedMs: 0,
    payoutCoinAmount: payoutCoinAmountFor(spin),
    reels: spin?.reels ?? IDLE_REELS,
    displayed: state.displayedCollectibles ?? [],
    payoutCollectibleId: spin?.stage === "payout" && spin.reward.kind === "collectible"
      ? spin.reward.collectibleId
      : null,
    starryTheme: hasStarrySet(state.ownedCollectibles ?? []),
    agentStatus: state.agentStatus ?? "idle",
    reducedMotion: (state.settings?.reducedMotion ?? false) || systemReducedMotion,
  };
}

function payoutCoinAmountFor(spin: ResolvedSpin | null): number {
  if (spin === null) return 0;
  if (spin.reward.kind === "coins") return spin.reward.amount;
  if (spin.reward.kind === "collectible") {
    return spin.reward.conversionCoins + spin.reward.bonusCoins;
  }
  return 0;
}

function soundDisabled(state: GameState): boolean {
  return (state.settings?.muted ?? true) || (state.settings?.reducedMotion ?? false);
}

function statusMessage(
  state: GameState,
  mode: GameCanvasProps["mode"],
  error: string | null,
  rewardAnnouncement: string,
): string {
  if (error !== null) return error;
  if (mode === "readonly") return "当前标签页为只读镜像，经济操作已禁用。";
  if (mode === "unsupported") return "当前浏览器不支持写入锁，经济操作已禁用。";
  if (rewardAnnouncement !== "") return rewardAnnouncement;
  if (state.wallet <= 0 && state.activeSpin === null) {
    return "硬币不足；完成工作或等待次日赠币即可继续。";
  }
  return "";
}

function rewardMessageFor(spin: ResolvedSpin | null): string {
  if (spin?.stage !== "settled") return "";
  if (spin.reward.kind === "none") return "本次没有奖励。";
  if (spin.reward.kind === "coins") return `获得 ${spin.reward.amount} 枚硬币。`;
  const item = CATALOG_BY_ID[spin.reward.collectibleId];
  if (spin.reward.isDuplicate) {
    return `重复收藏品已折算为 ${spin.reward.conversionCoins + spin.reward.bonusCoins} 枚硬币。`;
  }
  return `获得收藏品${item === undefined ? "" : `：${item.name}`}。`;
}

function playStageCue(
  stage: ResolvedSpin["stage"] | null,
  spin: ResolvedSpin | null,
  muted: boolean,
): void {
  if (stage !== "payout" || spin === null) return;
  playSfx("payout", muted);
  if (spin.reward.kind !== "collectible") return;
  const rarity = CATALOG_BY_ID[spin.reward.collectibleId]?.rarity;
  if (rarity === "rare" || rarity === "set") playSfx("rare", muted);
}

function hasStarrySet(owned: readonly string[]): boolean {
  return owned.includes("star-projector") &&
    owned.includes("constellation-globe") &&
    owned.includes("comet-badge");
}

function getCanvasContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (canvas === null) return null;
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function scheduleFrame(callback: FrameRequestCallback): ScheduledFrame {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return { id: globalThis.requestAnimationFrame(callback), kind: "animation-frame" };
  }
  return {
    id: globalThis.setTimeout(() => callback(globalThis.performance.now()), 16),
    kind: "timeout",
  };
}

function cancelScheduledFrame(frame: ScheduledFrame): void {
  if (frame.kind === "animation-frame") {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(frame.id);
    }
    return;
  }
  globalThis.clearTimeout(frame.id);
}

function drawFallbackScene(context: CanvasRenderingContext2D, leverProgress: number): void {
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 384, 288);
  context.fillStyle = "#111b35";
  context.fillRect(24, 206, 336, 54);
  context.fillStyle = "#65371f";
  context.fillRect(24, 188, 336, 54);
  context.fillStyle = "#b9652a";
  context.fillRect(24, 188, 336, 5);
  context.fillStyle = "#28334d";
  context.fillRect(128, 48, 136, 146);
  context.fillStyle = "#43516c";
  context.fillRect(136, 56, 120, 130);
  context.fillStyle = "#e3a33a";
  context.fillRect(146, 68, 100, 54);
  context.fillStyle = "#101a32";
  for (let index = 0; index < 3; index += 1) {
    context.fillRect(151 + index * 32, 73, 27, 44);
  }
  context.fillStyle = "#121a2d";
  context.fillRect(166, 143, 60, 24);
  context.fillStyle = "#1a2942";
  const leverDrop = Math.round(Math.max(0, Math.min(1, leverProgress)) * 18);
  context.fillRect(270, 78 + leverDrop, 6, 62);
  context.fillStyle = "#34b8ae";
  context.fillRect(268, 75 + leverDrop, 10, 10);
}
