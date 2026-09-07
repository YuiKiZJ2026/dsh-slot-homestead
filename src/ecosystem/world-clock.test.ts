import { describe, expect, it } from "vitest";
import { createInitialEcosystemState } from "../domain/types";
import { advanceEcosystemTo } from "./lifecycle";
import { advanceWorld, MAX_WORLD_ELAPSED_MS, WORLD_MAX_REAL_ADVANCE_MS, WORLD_TIME_RATE, worldDate, worldView } from "./world-clock";

const realStart = new Date("2026-09-07T04:00:00.000Z");
const at = (milliseconds: number) => new Date(realStart.getTime() + milliseconds);
const hour = 3_600_000;

describe("persistent homestead world clock", () => {
  it("begins on day one at 06:00 independently of the computer date and timezone", () => {
    const initial = createInitialEcosystemState();
    const state = advanceWorld(initial, realStart, 42);
    expect(WORLD_TIME_RATE).toBe(30);
    expect(state.world).toEqual({ elapsedMs: 0, lastRealAt: realStart.toISOString(), seed: 42 });
    expect(worldView(state.world)).toMatchObject({ day: 1, hour: 6, minute: 0, minuteOfDay: 360 });
    expect(worldView()).toMatchObject({ day: 1, hour: 6, minute: 0 });
    expect(worldDate().toISOString()).toBe("2000-01-01T06:00:00.000Z");
    expect(initial.world).toBeUndefined();
    expect(initial.lifecycle.lastSimulatedAt).toBeNull();
  });

  it("turns one real minute into thirty game minutes and advances ecosystem growth", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart, 42);
    const next = advanceWorld(initial, at(60_000));
    expect(worldView(next.world)).toMatchObject({ day: 1, hour: 6, minute: 30, minuteOfDay: 390 });
    expect(next.lifecycle.lastSimulatedAt).toBe("2000-01-01T06:30:00.000Z");
    expect(next.lifecycle.fish.goldfish.growth).toBe(2);
    expect(next.lifecycle.plots["1"].growth).toBe(2.5);
    expect(initial.lifecycle.fish.goldfish.growth).toBe(0);
  });

  it("crosses midnight and multiple game days without an actual system-date change", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart);
    const midnight = advanceWorld(initial, at(36 * 60_000));
    expect(worldView(midnight.world)).toMatchObject({ day: 2, hour: 0, minute: 0 });
    const multiDay = advanceWorld(initial, at(4 * hour));
    expect(worldView(multiDay.world)).toMatchObject({ day: 6, hour: 6, minute: 0 });
    expect(worldDate(multiDay.world).toISOString()).toBe("2000-01-06T06:00:00.000Z");
  });

  it("has the same clock and growth after frequent polling as a single advance", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart, 7);
    let polled = initial;
    for (let second = 1; second <= 600; second++) polled = advanceWorld(polled, at(second * 1000));
    const once = advanceWorld(initial, at(600_000));
    expect(polled.world).toEqual(once.world);
    expect(polled.lifecycle.lastSimulatedAt).toBe(once.lifecycle.lastSimulatedAt);
    expect(polled.lifecycle.fish.goldfish.growth).toBeCloseTo(once.lifecycle.fish.goldfish.growth, 9);
    expect(polled.lifecycle.plots["1"].growth).toBeCloseTo(once.lifecycle.plots["1"].growth, 9);
    expect(polled.lifecycle.livestock.chick.juvenileGrowth).toBeCloseTo(once.lifecycle.livestock.chick.juvenileGrowth, 9);
  });

  it("continues after serialization and ignores clock rollback without reusing elapsed time", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart, 0xffffffff);
    const first = advanceWorld(initial, at(60_000));
    const restored = JSON.parse(JSON.stringify(first)) as typeof first;
    const rollback = advanceWorld(restored, at(-hour), 123);
    expect(rollback).toEqual(restored);
    expect(advanceWorld(rollback, at(60_000))).toEqual(restored);
    const next = advanceWorld(rollback, at(120_000), 456);
    expect(next.world).toEqual({ elapsedMs: hour, lastRealAt: at(120_000).toISOString(), seed: 0xffffffff });
  });

  it("limits catch-up to 24 real hours, advances the full 30 game days, and discards excess only once", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart, 7);
    expect(WORLD_MAX_REAL_ADVANCE_MS).toBe(24 * hour);
    const late = at(90 * 24 * hour);
    const next = advanceWorld(initial, late);
    expect(next.world).toEqual({ elapsedMs: 30 * 24 * hour, lastRealAt: late.toISOString(), seed: 7 });
    expect(worldView(next.world)).toMatchObject({ day: 31, hour: 6 });
    expect(next.lifecycle.lastSimulatedAt).toBe(worldDate(next.world).toISOString());
    expect(next.lifecycle.plots["1"].readyYield).toBe(1);
    expect(advanceWorld(next, late)).toEqual(next);
    expect(advanceWorld(next, new Date(late.getTime() + 60_000)).world?.elapsedMs).toBe(next.world!.elapsedMs + 30 * 60_000);
  });

  it("rebases old saves without losing grown residents, ready harvests, crop plans, or remaining boosts", () => {
    const old = createInitialEcosystemState();
    old.lifecycle.lastSimulatedAt = at(-hour).toISOString();
    old.lifecycle.fish.goldfish.growth = 47;
    old.lifecycle.fish.goldfish.boostedUntil = at(2 * hour).toISOString();
    old.lifecycle.plots["1"] = { seedId: "carrot-seed", growth: 100, readyYield: 1, boostedUntil: at(3 * hour).toISOString(), generation: 4, nextSeedId: "tomato-seed" };
    old.lifecycle.livestock.chick.boostedUntil = at(-1).toISOString();
    old.lifecycle.produce.egg = 7;
    old.journal = { day: "2026-09-07", care: ["garden"], harvests: 1, dailyClaimed: [], milestonesClaimed: ["green-fingers"], xp: 90 };
    old.merchant = { visitId: "merchant-1-2", purchased: { "fish-feed": 2 }, soldCount: 4 };
    const before = structuredClone(old);
    const next = advanceWorld(old, realStart, 17);
    expect(next.lifecycle.fish.goldfish).toEqual({ count: 1, growth: 47, boostedUntil: "2000-01-01T08:00:00.000Z" });
    expect(next.lifecycle.plots["1"]).toEqual({ ...before.lifecycle.plots["1"], boostedUntil: "2000-01-01T09:00:00.000Z" });
    expect(next.lifecycle.livestock.chick.boostedUntil).toBeNull();
    expect(next.lifecycle.produce).toEqual({ egg: 7 });
    expect(next.journal).toEqual({ ...before.journal, day: "2000-01-01" });
    expect(next.merchant).toEqual(before.merchant);
    expect(old).toEqual(before);
    expect(next.lifecycle.lastSimulatedAt).toBe(worldDate().toISOString());
    expect(advanceWorld(next, at(60_000)).lifecycle.fish.goldfish.growth).toBe(51);
  });

  it("does not recreate boost time if the old lifecycle anchor is ahead of the system clock", () => {
    const old = createInitialEcosystemState();
    old.lifecycle.lastSimulatedAt = at(hour).toISOString();
    old.lifecycle.fish.goldfish.boostedUntil = at(2 * hour).toISOString();
    const next = advanceWorld(old, realStart);
    expect(next.lifecycle.fish.goldfish.boostedUntil).toBe("2000-01-01T07:00:00.000Z");
  });

  it("keeps elapsed time safely bounded and all virtual dates valid at the boundary", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart);
    initial.world!.elapsedMs = MAX_WORLD_ELAPSED_MS - 10;
    initial.lifecycle.lastSimulatedAt = worldDate(initial.world).toISOString();
    const next = advanceWorld(initial, at(1000));
    expect(next.world?.elapsedMs).toBe(MAX_WORLD_ELAPSED_MS);
    expect(Number.isSafeInteger(next.world?.elapsedMs)).toBe(true);
    expect(Number.isFinite(worldDate(next.world).getTime())).toBe(true);
    expect(worldDate({ ...next.world!, elapsedMs: Number.MAX_SAFE_INTEGER }).getTime()).toBe(worldDate(next.world).getTime());
    expect(worldView({ ...next.world!, elapsedMs: -1 })).toMatchObject({ day: 1, hour: 6 });
    expect(worldView({ ...next.world!, elapsedMs: Number.NaN })).toMatchObject({ day: 1, hour: 6 });
  });

  it("never mutates or initializes a clock with an invalid real date and normalizes a seed only at creation", () => {
    const initial = createInitialEcosystemState();
    expect(advanceWorld(initial, new Date("bad"), 2)).toBe(initial);
    expect(advanceWorld(initial, new Date("0999-12-31T23:59:59.000Z"))).toBe(initial);
    expect(advanceWorld(initial, new Date("+010000-01-01T00:00:00.000Z"))).toBe(initial);
    const created = advanceWorld(initial, realStart, -7);
    expect(Number.isInteger(created.world?.seed)).toBe(true);
    expect(created.world?.seed).toBeGreaterThanOrEqual(0);
    expect(created.world?.seed).toBeLessThanOrEqual(0xffffffff);
    expect(advanceWorld(created, new Date("bad"))).toBe(created);
  });

  it("anchors a malformed imported timestamp without inventing elapsed growth", () => {
    const initial = advanceWorld(createInitialEcosystemState(), realStart, 9);
    initial.world!.lastRealAt = "unparseable";
    const repaired = advanceWorld(initial, at(hour));
    expect(repaired.world).toEqual({ elapsedMs: 0, lastRealAt: at(hour).toISOString(), seed: 9 });
    expect(repaired.lifecycle).toEqual(initial.lifecycle);
    const legacy = createInitialEcosystemState();
    legacy.lifecycle.lastSimulatedAt = "unparseable";
    legacy.lifecycle.fish.goldfish.boostedUntil = at(hour).toISOString();
    expect(advanceWorld(legacy, realStart).lifecycle.fish.goldfish.boostedUntil).toBe("2000-01-01T07:00:00.000Z");
  });

  it("leaves pure legacy domain operations on their original real-time semantics", () => {
    const initial = advanceEcosystemTo(createInitialEcosystemState(), realStart);
    const next = advanceEcosystemTo(initial, at(hour));
    expect(next.world).toBeUndefined();
    expect(next.lifecycle.fish.goldfish.growth).toBe(4);
  });
});
