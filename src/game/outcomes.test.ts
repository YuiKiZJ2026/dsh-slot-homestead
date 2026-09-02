import { describe, expect, it } from "vitest";
import { COLLECTIBLES } from "../domain/catalog";
import { createInitialState } from "../domain/types";
import { createPaidSpin, reelsForOutcome } from "./outcomes";

function sequence(...values: number[]) {
  let index = 0;
  return { next: () => values[index++] ?? values.at(-1) ?? 0 };
}

const now = new Date("2026-08-26T08:00:00Z");

describe("paid spin resolution", () => {
  it("refuses a spin without a coin", () => {
    const result = createPaidSpin(createInitialState(), sequence(0), now, () => "spin-1");

    expect(result).toEqual({ ok: false, reason: "INSUFFICIENT_COINS" });
  });

  it("deducts one coin and locks the complete five-coin result", () => {
    const state = createInitialState();
    state.wallet = 3;

    const result = createPaidSpin(state, sequence(0.7), now, () => "spin-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallet).toBe(2);
    expect(result.spin).toMatchObject({
      id: "spin-1",
      stage: "coin-inserted",
      reels: ["coin", "coin", "coin"],
      reward: { kind: "coins", amount: 5, reason: "five-coins" },
      pityAfter: 1,
      createdAt: "2026-08-26T08:00:00.000Z",
    });
    expect(result.state.activeSpin).toEqual(result.spin);
  });

  it("forces an unowned collectible before the base roll on miss eleven", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 10;

    const result = createPaidSpin(state, sequence(0.1, 0.1), now, () => "spin-pity");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward.kind).toBe("collectible");
    expect(result.spin.pityAfter).toBe(0);
  });

  it("converts a duplicate common item and keeps pity progressing", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 4;
    state.ownedCollectibles = ["plant"];

    const result = createPaidSpin(state, sequence(0.8, 0), now, () => "spin-dup");

    expect(result.ok).toBe(true);
    if (!result.ok || result.spin.reward.kind !== "collectible") return;
    expect(result.spin.reward).toMatchObject({
      collectibleId: "plant",
      isDuplicate: true,
      conversionCoins: 3,
      bonusCoins: 0,
    });
    expect(result.spin.pityAfter).toBe(5);
  });

  it("can award a new ecosystem resident from an ordinary common spin", () => {
    const state = createInitialState();
    state.wallet = 1;

    const result = createPaidSpin(state, sequence(0.8, 0.79), now, () => "spin-ecosystem");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({
      kind: "ecosystem-item",
      itemId: "moon-carp",
      isDuplicate: false,
      conversionCoins: 0,
    });
    expect(result.spin.pityAfter).toBe(0);
  });

  it("locks the duplicate conversion value into an ecosystem reward", () => {
    const state = createInitialState();
    state.wallet = 1;

    const result = createPaidSpin(state, sequence(0.8, 0.75), now, () => "spin-ecosystem-duplicate");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({
      kind: "ecosystem-item",
      itemId: "goldfish",
      isDuplicate: true,
      conversionCoins: 3,
    });
    expect(result.spin.pityAfter).toBe(1);
  });

  it("treats a supply as consumable progress instead of a new collection", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 6;

    const result = createPaidSpin(state, sequence(0.8, 0.96), now, () => "spin-fish-feed");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({
      kind: "ecosystem-item",
      itemId: "fish-feed",
      isDuplicate: false,
      conversionCoins: 0,
    });
    expect(result.spin.pityAfter).toBe(7);
  });

  it("preserves pity progress when the awarded supply is already at capacity", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 9;
    state.ecosystem.supplies.fishFeed = 999;

    const result = createPaidSpin(state, sequence(0.8, 0.96), now, () => "spin-full-feed");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toMatchObject({
      kind: "ecosystem-item",
      itemId: "fish-feed",
    });
    expect(result.spin.pityAfter).toBe(10);
  });

  it("resolves the robot jackpot to twelve coins when all rares are owned", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.ownedCollectibles = ["crystal", "moon-lamp", "mini-robot"];

    const result = createPaidSpin(state, sequence(0.995), now, () => "spin-robot");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({ kind: "coins", amount: 12, reason: "robot-fallback" });
    expect(result.spin.reels).toEqual(["robot", "robot", "robot"]);
    expect(result.spin.pityAfter).toBe(1);
  });

  it.each([
    [0, "none", undefined],
    [0.449_999, "none", undefined],
    [0.45, "refund", undefined],
    [0.689_999, "refund", undefined],
    [0.69, "five-coins", undefined],
    [0.769_999, "five-coins", undefined],
    [0.77, "common", "plant"],
    [0.889_999, "common", "plant"],
    [0.89, "rare", "crystal"],
    [0.959_999, "rare", "crystal"],
    [0.96, "set", "star-projector"],
    [0.989_999, "set", "star-projector"],
    [0.99, "robot-jackpot", "crystal"],
    [0.999_999, "robot-jackpot", "crystal"],
  ])("uses the %s half-open boundary for %s", (roll, kind, collectibleId) => {
    const state = createInitialState();
    state.wallet = 1;

    const result = createPaidSpin(state, sequence(roll, 0), now, () => `spin-${String(roll)}`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    if (collectibleId !== undefined) {
      expect(result.spin.reward).toMatchObject({ kind: "collectible", collectibleId });
      return;
    }

    expect(result.spin.reward).toMatchObject(
      kind === "none" ? { kind: "none" } : { kind: "coins", reason: kind },
    );
  });

  it("uses valid literal reel layouts for losses and refunds", () => {
    expect(reelsForOutcome("none", 0)).toEqual(["leaf", "crystal", "moon"]);
    expect(reelsForOutcome("none", 0.999_999)).toEqual(["robot", "leaf", "crystal"]);
    expect(reelsForOutcome("refund", 0)).toEqual(["coin", "coin", "leaf"]);
    expect(reelsForOutcome("refund", 0.999_999)).toEqual(["coin", "coin", "robot"]);
  });

  it("maps every winning outcome to its three matching payout symbols", () => {
    expect(reelsForOutcome("five-coins", 0)).toEqual(["coin", "coin", "coin"]);
    expect(reelsForOutcome("common", 0)).toEqual(["leaf", "leaf", "leaf"]);
    expect(reelsForOutcome("rare", 0)).toEqual(["crystal", "crystal", "crystal"]);
    expect(reelsForOutcome("set", 0)).toEqual(["moon", "moon", "moon"]);
    expect(reelsForOutcome("robot-jackpot", 0)).toEqual(["robot", "robot", "robot"]);
  });

  it("keeps pity progressing for an ordinary loss and caps it at ten", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 9;

    const result = createPaidSpin(state, sequence(0), now, () => "spin-loss");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({ kind: "none" });
    expect(result.spin.pityAfter).toBe(10);
  });

  it("forces a common outcome without using pity, the base roll, or random selection", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 10;

    const result = createPaidSpin(
      state,
      { next: () => { throw new Error("forced outcomes must not read random values"); } },
      now,
      () => "spin-forced",
      "common",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({
      kind: "collectible",
      collectibleId: "plant",
      isDuplicate: false,
      conversionCoins: 0,
      bonusCoins: 0,
    });
    expect(result.spin.pityAfter).toBe(0);
  });

  it("forces a completed collectible pool to its first catalog duplicate without activating pity", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 10;
    state.ownedCollectibles = COLLECTIBLES.filter((item) => item.rarity === "common").map((item) => item.id);

    const result = createPaidSpin(state, sequence(0), now, () => "spin-forced-duplicate", "common");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({
      kind: "collectible",
      collectibleId: "plant",
      isDuplicate: true,
      conversionCoins: 3,
      bonusCoins: 0,
    });
    expect(result.spin.pityAfter).toBe(10);
  });

  it("falls back to the available rare pity pool when no common remains", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 10;
    state.ownedCollectibles = COLLECTIBLES.filter((item) => item.rarity === "common").map((item) => item.id);

    const result = createPaidSpin(state, sequence(0.1, 0.999_999), now, () => "spin-pity-rare");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toMatchObject({
      kind: "collectible",
      collectibleId: "mini-robot",
      isDuplicate: false,
    });
    expect(result.spin.pityAfter).toBe(0);
  });

  it("pays the nine-coin pity fallback when common and rare pools are complete", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 10;
    state.ownedCollectibles = COLLECTIBLES
      .filter((item) => item.rarity === "common" || item.rarity === "rare")
      .map((item) => item.id);

    const result = createPaidSpin(state, sequence(0), now, () => "spin-pity-coins");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({ kind: "coins", amount: 9, reason: "pity-fallback" });
    expect(result.spin.pityAfter).toBe(0);
  });

  it("rejects a second insert while the first paid spin is active", () => {
    const state = createInitialState();
    state.wallet = 2;
    const first = createPaidSpin(state, sequence(0.7), now, () => "spin-first");

    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = createPaidSpin(first.state, sequence(0.7), now, () => "spin-second");

    expect(second).toEqual({ ok: false, reason: "ACTIVE_SPIN" });
  });
});
