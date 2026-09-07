import { z } from "zod";
import type { EcosystemState, HomesteadWorld } from "../domain/types";
import { advanceEcosystemTo } from "./lifecycle";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WORLD_EPOCH_MS = Date.UTC(2000, 0, 1, 6);
/** One real minute advances thirty minutes in the homestead. */
export const WORLD_TIME_RATE = 30;
export const WORLD_MAX_REAL_ADVANCE_MS = DAY_MS;
/** A finite 1,000-year horizon also leaves virtual timestamps well inside the save schema's calendar range. */
export const MAX_WORLD_ELAPSED_MS = 365_000 * DAY_MS;
export const worldSchema: z.ZodType<HomesteadWorld> = z.object({
  elapsedMs: z.number().int().nonnegative().safe().max(MAX_WORLD_ELAPSED_MS),
  lastRealAt: z.iso.datetime({ offset: true }).refine(value => {
    const year = Number(value.slice(0, 4));
    return year >= 1000 && year <= 9999;
  }, "World anchor must use a supported calendar year"),
  seed: z.number().int().nonnegative().max(0xffffffff),
}).strict();

export interface HomesteadWorldView {
  day: number;
  hour: number;
  minute: number;
  minuteOfDay: number;
}

export function worldDate(world?: HomesteadWorld): Date {
  return new Date(WORLD_EPOCH_MS + boundedElapsed(world?.elapsedMs ?? 0));
}

/** World labels are UTC-based; the computer's timezone never changes a game day. */
export function worldView(world?: HomesteadWorld): HomesteadWorldView {
  const elapsed = boundedElapsed(world?.elapsedMs ?? 0);
  const minutesFromFirstMidnight = Math.floor(elapsed / MINUTE_MS) + 6 * 60;
  const minuteOfDay = minutesFromFirstMidnight % (24 * 60);
  return {
    day: Math.floor(minutesFromFirstMidnight / (24 * 60)) + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    minuteOfDay,
  };
}

/** Persist the returned ecosystem as one unit: game time and its real anchor must never be separated. */
export function advanceWorld(ecosystem: EcosystemState, realNow: Date, seed?: number): EcosystemState {
  const nowMs = realNow.getTime();
  if (!Number.isFinite(nowMs) || realNow.getUTCFullYear() < 1000 || realNow.getUTCFullYear() > 9999) return ecosystem;
  const current = ecosystem.world;
  if (!current) {
    const world: HomesteadWorld = { elapsedMs: 0, lastRealAt: realNow.toISOString(), seed: initialSeed(seed, nowMs) };
    const migrated = rebaseLegacyLifecycle(ecosystem, nowMs, worldDate(world).getTime());
    if (migrated.journal) migrated.journal = { ...migrated.journal, day: worldDate(world).toISOString().slice(0, 10) };
    return { ...advanceEcosystemTo(migrated, worldDate(world)), world };
  }

  const lastRealMs = Date.parse(current.lastRealAt);
  if (Number.isFinite(lastRealMs) && nowMs <= lastRealMs) return ecosystem;
  const oldElapsed = boundedElapsed(current.elapsedMs);
  const realDelta = Number.isFinite(lastRealMs) ? Math.min(nowMs - lastRealMs, WORLD_MAX_REAL_ADVANCE_MS) : 0;
  const elapsedMs = Math.min(MAX_WORLD_ELAPSED_MS, oldElapsed + realDelta * WORLD_TIME_RATE);
  const world: HomesteadWorld = { elapsedMs, lastRealAt: realNow.toISOString(), seed: current.seed };
  let next = ecosystem;
  let simulatedMs = WORLD_EPOCH_MS + oldElapsed;
  const targetMs = WORLD_EPOCH_MS + elapsedMs;
  // The legacy ecology engine bounds each call at seven days. Daily chunks let
  // the world's 24-real-hour cap advance the complete (up to 30-game-day) span.
  while (simulatedMs < targetMs) {
    simulatedMs = Math.min(targetMs, simulatedMs + DAY_MS);
    next = advanceEcosystemTo(next, new Date(simulatedMs));
  }
  return { ...next, world };
}

function rebaseLegacyLifecycle(current: EcosystemState, realNowMs: number, virtualNowMs: number): EcosystemState {
  const next = structuredClone(current);
  const oldAnchor = next.lifecycle.lastSimulatedAt === null ? realNowMs : Date.parse(next.lifecycle.lastSimulatedAt);
  const referenceMs = Number.isFinite(oldAnchor) ? Math.max(realNowMs, oldAnchor) : realNowMs;
  for (const life of [
    ...Object.values(next.lifecycle.fish),
    ...Object.values(next.lifecycle.plots),
    ...Object.values(next.lifecycle.livestock),
  ]) {
    const untilMs = life.boostedUntil === null ? Number.NaN : Date.parse(life.boostedUntil);
    const remainingMs = Number.isFinite(untilMs) ? Math.max(0, untilMs - referenceMs) : 0;
    life.boostedUntil = remainingMs > 0
      ? new Date(virtualNowMs + Math.min(remainingMs, MAX_WORLD_ELAPSED_MS)).toISOString()
      : null;
  }
  next.lifecycle.lastSimulatedAt = new Date(virtualNowMs).toISOString();
  return next;
}

function boundedElapsed(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_WORLD_ELAPSED_MS, Math.max(0, Math.floor(value))) : 0;
}

function initialSeed(seed: number | undefined, nowMs: number): number {
  if (seed !== undefined && Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff) return seed;
  return (Math.trunc(nowMs) ^ Math.floor(nowMs / 0x100000000)) >>> 0;
}
