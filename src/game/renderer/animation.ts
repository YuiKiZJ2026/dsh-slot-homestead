import { comboIdsForDisplayed } from "../../domain/collectible-combos";
import type { AgentStatus, ReelSymbol, TablePlacement } from "../../domain/types";

export interface AnimationInput {
  stage: "coin-inserted" | "spinning" | "highlight" | "payout" | "settled";
  spinId: string | null;
  elapsedMs: number;
  agentElapsedMs: number;
  payoutCoinAmount: number;
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  displayed: string[];
  placements: TablePlacement[];
  payoutCollectibleId: string | null;
  starryTheme: boolean;
  agentStatus: AgentStatus;
  reducedMotion: boolean;
}

export interface SceneEffects {
  plantOffsetX: number;
  moonGlow: number;
  workingSweepX: number;
  robotIndicator: boolean;
  collectibleBounce: Readonly<Record<string, number>>;
  robotRetreatX: number;
  crystalAlpha: number;
}

export interface SceneViewModel {
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  reelCells: readonly [
    readonly [ReelSymbol, ReelSymbol, ReelSymbol, ReelSymbol],
    readonly [ReelSymbol, ReelSymbol, ReelSymbol, ReelSymbol],
    readonly [ReelSymbol, ReelSymbol, ReelSymbol, ReelSymbol],
  ];
  reelOffsets: readonly [number, number, number];
  reelStopped: readonly [boolean, boolean, boolean];
  leverProgress: number;
  coins: Array<{ x: number; y: number; startY: number; size: number }>;
  sparkles: Array<{ x: number; y: number; frame: number }>;
  displayed: string[];
  placements: TablePlacement[];
  payoutCollectibleId: string | null;
  payoutCoinAmount: number;
  agentStatus: AgentStatus;
  starryTheme: boolean;
  complete: boolean;
  payoutPosition?: { x: number; y: number } | null;
  effects?: SceneEffects;
}

const REEL_STOP_TIMES = [1_800, 2_100, 2_400] as const;
const REEL_SYMBOL_BELT: readonly ReelSymbol[] = [
  "coin", "leaf", "moon", "crystal", "robot", "leaf", "coin", "crystal", "moon", "robot",
];
const PAYOUT_START = { x: 213, y: 143 } as const;
const PAYOUT_STORAGE_TARGET = { x: 213, y: 166 } as const;
const PHASE_DURATIONS: Record<AnimationInput["stage"], number> = {
  "coin-inserted": 320,
  spinning: 2_400,
  highlight: 480,
  payout: 1_000,
  settled: 0,
};

export function animationFrameFor(input: AnimationInput): SceneViewModel {
  const elapsedMs = finiteElapsed(input.elapsedMs);
  const agentElapsedMs = finiteElapsed(input.agentElapsedMs);
  const payoutCoinAmount = finiteCoinAmount(input.payoutCoinAmount);
  const direct = input.reducedMotion;
  const reelStopped = sampleReelStops(input.stage, elapsedMs, direct);
  const reelOffsets = sampleReelOffsets(input.stage, elapsedMs, reelStopped);
  const reelCells = sampleReelCells(input.reels, reelOffsets, reelStopped, input.spinId);
  const payoutPosition = samplePayoutPosition(input.payoutCollectibleId, input.stage, elapsedMs, direct);
  const effects = sampleEffects(input.displayed, input.agentStatus, agentElapsedMs, direct);

  return {
    reels: [...input.reels] as [ReelSymbol, ReelSymbol, ReelSymbol],
    reelCells,
    reelOffsets,
    reelStopped,
    leverProgress: direct ? 0 : leverTriangle(elapsedMs),
    coins: direct ? [] : sampleCoins(input.stage, elapsedMs, payoutCoinAmount),
    sparkles: direct ? [] : sampleSparkles(
      input.stage,
      input.agentStatus,
      elapsedMs,
      agentElapsedMs,
      payoutPosition,
      input.displayed,
    ),
    displayed: [...input.displayed],
    placements: input.placements.map((placement) => ({ ...placement })),
    payoutCollectibleId: input.payoutCollectibleId,
    payoutCoinAmount,
    agentStatus: input.agentStatus,
    starryTheme: input.starryTheme,
    complete: direct || elapsedMs >= PHASE_DURATIONS[input.stage],
    payoutPosition,
    effects,
  };
}

function finiteElapsed(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finiteCoinAmount(value: number): number {
  return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
}

function leverTriangle(elapsedMs: number): number {
  if (elapsedMs >= 320) return 0;
  return elapsedMs <= 160 ? elapsedMs / 160 : (320 - elapsedMs) / 160;
}

function sampleReelStops(
  stage: AnimationInput["stage"],
  elapsedMs: number,
  direct: boolean,
): [boolean, boolean, boolean] {
  if (direct || stage !== "spinning") return [true, true, true];
  return REEL_STOP_TIMES.map((stopTime) => elapsedMs >= stopTime) as [boolean, boolean, boolean];
}

function sampleReelOffsets(
  stage: AnimationInput["stage"],
  elapsedMs: number,
  stopped: readonly [boolean, boolean, boolean],
): [number, number, number] {
  if (stage !== "spinning") return [0, 0, 0];
  const rates = [7, 9, 11] as const;
  return stopped.map((isStopped, index) => (
    isStopped ? 0 : Math.floor(elapsedMs / 32) * rates[index] + index * 17
  )) as [number, number, number];
}

function sampleReelCells(
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol],
  distances: readonly [number, number, number],
  stopped: readonly [boolean, boolean, boolean],
  spinId: string | null,
): SceneViewModel["reelCells"] {
  return [
    cellsForReel(reels[0], distances[0], stopped[0], spinId, 0),
    cellsForReel(reels[1], distances[1], stopped[1], spinId, 1),
    cellsForReel(reels[2], distances[2], stopped[2], spinId, 2),
  ];
}

function cellsForReel(
  finalSymbol: ReelSymbol,
  distance: number,
  stopped: boolean,
  spinId: string | null,
  reelIndex: number,
): SceneViewModel["reelCells"][number] {
  if (stopped) return [finalSymbol, finalSymbol, finalSymbol, finalSymbol];
  const belt = REEL_SYMBOL_BELT.filter((symbol) => symbol !== finalSymbol);
  const phase = positiveModulo(stableHash(`${spinId ?? ""}:${reelIndex}`), belt.length);
  const firstCell = -Math.floor(distance / 18);
  return [
    belt[positiveModulo(phase + firstCell, belt.length)],
    belt[positiveModulo(phase + firstCell + 1, belt.length)],
    belt[positiveModulo(phase + firstCell + 2, belt.length)],
    belt[positiveModulo(phase + firstCell + 3, belt.length)],
  ];
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function samplePayoutPosition(
  collectibleId: string | null,
  stage: AnimationInput["stage"],
  elapsedMs: number,
  direct: boolean,
): { x: number; y: number } | null {
  if (collectibleId === null) return null;
  const progress = direct ? 1 : stage === "payout" ? clamp01(elapsedMs / 1_000) : 0;
  return {
    x: Math.round(lerp(PAYOUT_START.x, PAYOUT_STORAGE_TARGET.x, progress)),
    y: Math.round(lerp(PAYOUT_START.y, PAYOUT_STORAGE_TARGET.y, progress)),
  };
}

function sampleCoins(
  stage: AnimationInput["stage"],
  elapsedMs: number,
  payoutCoinAmount: number,
): Array<{ x: number; y: number; startY: number; size: number }> {
  if (stage !== "payout" || payoutCoinAmount === 0) return [];
  const progress = clamp01(elapsedMs / 1_000);
  return Array.from({ length: 8 }, (_, index) => {
    const startY = 202 + index % 3;
    const arcHeight = 30 + index * 2;
    return {
      x: lerp(216 + index, 150 + index * 17, progress),
      y: startY - 4 * progress * (1 - progress) * arcHeight,
      startY,
      size: 2 + index % 3,
    };
  });
}

function sampleSparkles(
  stage: AnimationInput["stage"],
  agentStatus: AgentStatus,
  phaseElapsedMs: number,
  agentElapsedMs: number,
  payoutPosition: { x: number; y: number } | null,
  displayed: readonly string[],
): Array<{ x: number; y: number; frame: number }> {
  let reaction: Array<{ x: number; y: number; frame: number }> = [];
  if (agentStatus === "completed") {
    if (agentElapsedMs <= 1_200) {
      reaction = Array.from({ length: 6 }, (_, index) => ({
        x: 48 + index * 51,
        y: 92 + (index % 3) * 28,
        frame: (Math.floor(agentElapsedMs / 80) + index) % 3,
      }));
    }
  } else if (stage === "payout") {
    const center = payoutPosition ?? PAYOUT_START;
    reaction = Array.from({ length: 4 }, (_, index) => ({
      x: center.x - 12 + index * 8,
      y: center.y - 18 - (index % 2) * 6,
      frame: (Math.floor(phaseElapsedMs / 80) + index) % 3,
    }));
  }
  const comboSparkles = comboIdsForDisplayed(displayed).flatMap((_comboId, index) => ([
    { x: 82 + index * 104, y: 105 + index * 12, frame: Math.floor(agentElapsedMs / 160) % 3 },
    { x: 112 + index * 104, y: 80 + index * 10, frame: (Math.floor(agentElapsedMs / 160) + 1) % 3 },
  ]));
  return [...reaction, ...comboSparkles].slice(0, 6);
}

function sampleEffects(
  displayed: readonly string[],
  status: AgentStatus,
  elapsedMs: number,
  direct: boolean,
): SceneEffects {
  const effects: SceneEffects = {
    plantOffsetX: 0,
    moonGlow: 0,
    workingSweepX: 0,
    robotIndicator: false,
    collectibleBounce: {},
    robotRetreatX: 0,
    crystalAlpha: 1,
  };
  if (direct) return effects;

  if (status === "idle") {
    if (displayed.includes("plant")) {
      effects.plantOffsetX = Math.round(Math.sin(elapsedMs * Math.PI / 600));
    }
    if (displayed.includes("moon-lamp")) {
      effects.moonGlow = (Math.sin(elapsedMs * Math.PI / 600) + 1) / 2;
    }
  } else if (status === "working") {
    effects.workingSweepX = Math.floor((elapsedMs % 800) * 42 / 800);
    effects.robotIndicator = Math.floor(elapsedMs / 160) % 2 === 0;
  } else if (status === "completed") {
    effects.collectibleBounce = Object.fromEntries(displayed.map((id, index) => {
      const local = elapsedMs - index * 80;
      const bounce = local >= 0 && local <= 320 ? -Math.round(Math.sin(local * Math.PI / 320) * 5) : 0;
      return [id, bounce];
    }));
  } else if (status === "error") {
    const pulse = elapsedMs <= 600 ? Math.sin(elapsedMs * Math.PI / 600) : 0;
    effects.robotRetreatX = displayed.includes("mini-robot") && pulse > 0 ? -Math.round(pulse * 6) : 0;
    effects.crystalAlpha = displayed.includes("crystal") ? 1 - pulse * 0.55 : 1;
  }
  return effects;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
