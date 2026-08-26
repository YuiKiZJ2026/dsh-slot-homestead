import { describe, expect, it } from "vitest";
import { animationFrameFor, type AnimationInput } from "./animation";

const base: AnimationInput = {
  stage: "spinning",
  spinId: "spin-base",
  elapsedMs: 0,
  agentElapsedMs: 0,
  payoutCoinAmount: 5,
  reels: ["coin", "leaf", "moon"],
  displayed: [],
  payoutCollectibleId: null,
  starryTheme: false,
  agentStatus: "idle",
  reducedMotion: false,
};

describe("animationFrameFor", () => {
  it("uses a mixed belt and excludes each final symbol before that reel stops", () => {
    const frame = animationFrameFor({
      ...base,
      spinId: "spin-42",
      elapsedMs: 1_000,
      reels: ["leaf", "moon", "coin"],
    });

    expect(new Set(frame.reelCells[0]).size).toBeGreaterThan(1);
    expect(frame.reelCells[0]).not.toContain("leaf");
    expect(frame.reelCells[1]).not.toContain("moon");
    expect(frame.reelCells[2]).not.toContain("coin");
  });

  it("shifts belt cells into the next renderer slot when distance crosses 18 pixels", () => {
    const beforeBoundary = animationFrameFor({ ...base, elapsedMs: 0 });
    const afterBoundary = animationFrameFor({ ...base, elapsedMs: 32 });

    expect(beforeBoundary.reelOffsets[1]).toBe(17);
    expect(afterBoundary.reelOffsets[1]).toBe(26);
    expect(afterBoundary.reelCells[1].slice(1)).toEqual(beforeBoundary.reelCells[1].slice(0, 3));
  });

  it("returns the exact lever endpoints", () => {
    expect(animationFrameFor({ ...base, elapsedMs: 0 }).leverProgress).toBe(0);
    expect(animationFrameFor({ ...base, elapsedMs: 160 }).leverProgress).toBe(1);
    expect(animationFrameFor({ ...base, elapsedMs: 320 }).leverProgress).toBe(0);
    expect(animationFrameFor({ ...base, elapsedMs: 480 }).leverProgress).toBe(0);
  });

  it("freezes reels at the exact left, middle, and right boundaries", () => {
    expect(animationFrameFor({ ...base, elapsedMs: 1799 }).reelStopped).toEqual([false, false, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 1800 }).reelStopped).toEqual([true, false, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 2099 }).reelStopped).toEqual([true, false, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 2100 }).reelStopped).toEqual([true, true, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 2399 }).reelStopped).toEqual([true, true, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 2400 }).reelStopped).toEqual([true, true, true]);
    expect(animationFrameFor({ ...base, elapsedMs: 2400 }).reelOffsets).toEqual([0, 0, 0]);
  });

  it.each([
    ["coin-inserted", 319, false], ["coin-inserted", 320, true],
    ["spinning", 2399, false], ["spinning", 2400, true],
    ["highlight", 479, false], ["highlight", 480, true],
    ["payout", 999, false], ["payout", 1000, true],
    ["settled", 0, true],
  ] as const)("marks %s at %d ms complete=%s", (stage, elapsedMs, complete) => {
    expect(animationFrameFor({ ...base, stage, elapsedMs }).complete).toBe(complete);
  });

  it("uses a bounded parabolic payout arc with sparse sparkles", () => {
    const payout = animationFrameFor({
      ...base,
      stage: "payout",
      elapsedMs: 500,
      payoutCollectibleId: "plant",
    });

    expect(payout.coins.length).toBeGreaterThanOrEqual(6);
    expect(payout.coins.length).toBeLessThanOrEqual(10);
    expect(payout.coins.every((coin) => coin.y < coin.startY)).toBe(true);
    expect(payout.sparkles.length).toBeLessThanOrEqual(6);
    expect(payout.payoutPosition).toEqual({ x: 129, y: 179 });
  });

  it.each([
    ["no reward", 0, false],
    ["coin reward", 5, true],
    ["new collectible only", 0, false],
    ["duplicate conversion and bonus", 12, true],
  ] as const)("shows payout coins for %s only when value is positive", (_label, amount, expected) => {
    const frame = animationFrameFor({
      ...base,
      stage: "payout",
      elapsedMs: 500,
      payoutCoinAmount: amount,
    });

    expect(frame.payoutCoinAmount).toBe(amount);
    expect(frame.coins.length > 0).toBe(expected);
  });

  it("moves a payout collectible from the payout slot to its catalog display center", () => {
    expect(animationFrameFor({
      ...base,
      stage: "payout",
      elapsedMs: 0,
      payoutCollectibleId: "plant",
    }).payoutPosition).toEqual({ x: 213, y: 143 });
    expect(animationFrameFor({
      ...base,
      stage: "payout",
      elapsedMs: 1000,
      payoutCollectibleId: "plant",
    }).payoutPosition).toEqual({ x: 44, y: 214 });
  });

  it("uses direct final states with no travel under reduced motion", () => {
    const reduced = animationFrameFor({
      ...base,
      stage: "payout",
      reducedMotion: true,
      elapsedMs: 100,
      payoutCollectibleId: "plant",
    });

    expect(reduced.complete).toBe(true);
    expect(reduced.reelStopped).toEqual([true, true, true]);
    expect(reduced.reelOffsets).toEqual([0, 0, 0]);
    expect(reduced.coins).toEqual([]);
    expect(reduced.sparkles).toEqual([]);
    expect(reduced.payoutPosition).toEqual({ x: 44, y: 214 });
  });

  it("samples idle plant sway and moon-lamp glow without mutating displayed items", () => {
    const displayed = ["plant", "moon-lamp"];
    const frame = animationFrameFor({ ...base, elapsedMs: 300, agentElapsedMs: 300, displayed });

    expect(frame.displayed).toEqual(["plant", "moon-lamp"]);
    expect(frame.displayed).not.toBe(displayed);
    expect(frame.effects?.plantOffsetX).not.toBe(0);
    expect(frame.effects?.moonGlow).toBeGreaterThan(0);
  });

  it("samples the working panel sweep and robot indicator", () => {
    const frame = animationFrameFor({
      ...base,
      elapsedMs: 200,
      agentElapsedMs: 200,
      displayed: ["mini-robot"],
      agentStatus: "working",
    });

    expect(frame.effects?.workingSweepX).toBeGreaterThanOrEqual(0);
    expect(typeof frame.effects?.robotIndicator).toBe("boolean");
  });

  it("sequences completed collectible bounces and caps celebration sparkles", () => {
    const frame = animationFrameFor({
      ...base,
      elapsedMs: 200,
      agentElapsedMs: 200,
      displayed: ["plant", "book-stand", "desk-clock", "warm-mug", "toolbox", "paper-lantern", "crystal"],
      agentStatus: "completed",
    });

    expect(Object.values(frame.effects?.collectibleBounce ?? {}).some((offset) => offset < 0)).toBe(true);
    expect(frame.sparkles.length).toBeLessThanOrEqual(6);
    expect(animationFrameFor({
      ...base,
      elapsedMs: 1_201,
      agentElapsedMs: 1_201,
      displayed: ["plant"],
      agentStatus: "completed",
    }).sparkles).toEqual([]);
  });

  it("samples agent reactions from their own elapsed timeline", () => {
    const frame = animationFrameFor({
      ...base,
      elapsedMs: 5_000,
      agentElapsedMs: 160,
      displayed: ["plant"],
      agentStatus: "completed",
    });

    expect(frame.effects?.collectibleBounce.plant).toBeLessThan(0);
    expect(frame.sparkles).toHaveLength(6);
  });

  it("returns error robot retreat and crystal dimming to baseline", () => {
    const active = animationFrameFor({
      ...base,
      elapsedMs: 300,
      agentElapsedMs: 300,
      displayed: ["mini-robot", "crystal"],
      agentStatus: "error",
    });
    const settled = animationFrameFor({
      ...base,
      elapsedMs: 700,
      agentElapsedMs: 700,
      displayed: ["mini-robot", "crystal"],
      agentStatus: "error",
    });

    expect(active.effects?.robotRetreatX).toBeLessThan(0);
    expect(active.effects?.crystalAlpha).toBeLessThan(1);
    expect(settled.effects?.robotRetreatX).toBe(0);
    expect(settled.effects?.crystalAlpha).toBe(1);
  });
});
