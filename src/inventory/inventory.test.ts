import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import {
  buyCollectible,
  hasStarryNightTheme,
  settleActiveSpin,
  setCollectiblePlacement,
  setCollectibleDisplayed,
} from "./inventory";

describe("inventory and shop", () => {
  it("settles a new collectible exactly once", () => {
    const state = createInitialState();
    state.activeSpin = {
      id: "spin-1", stage: "payout", reels: ["leaf", "leaf", "leaf"],
      reward: { kind: "collectible", collectibleId: "plant", isDuplicate: false, conversionCoins: 0, bonusCoins: 0 },
      pityAfter: 0, createdAt: "2026-08-26T00:00:00Z",
    };

    const once = settleActiveSpin(state, "spin-1");
    const twice = settleActiveSpin(once, "spin-1");

    expect(once.ownedCollectibles).toEqual(["plant"]);
    expect(once.displayedCollectibles).toEqual([]);
    expect(once.tablePlacements).toEqual([]);
    expect(once.activeSpin?.stage).toBe("settled");
    expect(twice).toBe(once);
  });

  it("keeps rewards in the collection box and atomically replaces an occupied table position", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "crystal"];

    const placed = setCollectiblePlacement(state, "plant", "left-front-round");
    expect(placed.tablePlacements).toEqual([
      { itemId: "plant", positionId: "left-front-round" },
    ]);
    expect(placed.displayedCollectibles).toEqual(["plant"]);

    const replaced = setCollectiblePlacement(placed, "crystal", "left-front-round");
    expect(replaced.tablePlacements).toEqual([
      { itemId: "crystal", positionId: "left-front-round" },
    ]);
    expect(replaced.displayedCollectibles).toEqual(["crystal"]);

    const moved = setCollectiblePlacement(placed, "plant", "right-rear-round");
    expect(moved.tablePlacements).toEqual([
      { itemId: "plant", positionId: "right-rear-round" },
    ]);

    const stored = setCollectiblePlacement(moved, "plant", null);
    expect(stored.tablePlacements).toEqual([]);
    expect(stored.displayedCollectibles).toEqual([]);
  });

  it("pays duplicate conversion and bonus coins", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["crystal"];
    state.activeSpin = {
      id: "spin-2", stage: "payout", reels: ["crystal", "crystal", "crystal"],
      reward: { kind: "collectible", collectibleId: "crystal", isDuplicate: true, conversionCoins: 9, bonusCoins: 3 },
      pityAfter: 5, createdAt: "2026-08-26T00:00:00Z",
    };

    const settled = settleActiveSpin(state, "spin-2");

    expect(settled.wallet).toBe(12);
    expect(settled.pityMisses).toBe(5);
  });

  it("applies a locked coin reward once", () => {
    const state = createInitialState();
    state.wallet = 4;
    state.activeSpin = {
      id: "spin-coins", stage: "payout", reels: ["coin", "coin", "coin"],
      reward: { kind: "coins", amount: 5, reason: "five-coins" },
      pityAfter: 2, createdAt: "2026-08-26T00:00:00Z",
    };

    const settled = settleActiveSpin(state, "spin-coins");

    expect(settled.wallet).toBe(9);
    expect(settled.pityMisses).toBe(2);
    expect(settleActiveSpin(settled, "spin-coins")).toBe(settled);
  });

  it("does not settle a different spin id", () => {
    const state = createInitialState();
    state.activeSpin = {
      id: "spin-current", stage: "payout", reels: ["coin", "coin", "coin"],
      reward: { kind: "coins", amount: 5, reason: "five-coins" },
      pityAfter: 1, createdAt: "2026-08-26T00:00:00Z",
    };

    expect(settleActiveSpin(state, "spin-other")).toBe(state);
  });

  it("buys only an unowned item with sufficient balance", () => {
    const state = createInitialState();
    state.wallet = 6;

    const bought = buyCollectible(state, "plant");

    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.wallet).toBe(0);
    expect(bought.state.ownedCollectibles).toEqual(["plant"]);
    expect(buyCollectible(bought.state, "plant")).toEqual({ ok: false, reason: "ALREADY_OWNED" });
  });

  it("rejects purchase of a new collectible locked by an unsettled spin", () => {
    const state = createInitialState();
    state.wallet = 6;
    state.activeSpin = {
      id: "spin-locked-plant",
      stage: "coin-inserted",
      reels: ["leaf", "leaf", "leaf"],
      reward: {
        kind: "collectible",
        collectibleId: "plant",
        isDuplicate: false,
        conversionCoins: 0,
        bonusCoins: 0,
      },
      pityAfter: 0,
      createdAt: "2026-08-26T00:00:00Z",
    };

    expect(buyCollectible(state, "plant")).toEqual({
      ok: false,
      reason: "LOCKED_SPIN_REWARD",
    });
    expect(state).toMatchObject({ wallet: 6, ownedCollectibles: [] });

    const payout = { ...state, activeSpin: { ...state.activeSpin, stage: "payout" as const } };
    expect(settleActiveSpin(payout, "spin-locked-plant")).toMatchObject({
      wallet: 6,
      ownedCollectibles: ["plant"],
      activeSpin: { stage: "settled" },
    });
  });

  it("rejects unknown shop items without changing state", () => {
    const state = createInitialState();
    state.wallet = 99;

    expect(buyCollectible(state, "unknown")).toEqual({ ok: false, reason: "UNKNOWN_ITEM" });
    expect(state).toMatchObject({ wallet: 99, ownedCollectibles: [], displayedCollectibles: [] });
  });

  it("rejects unaffordable shop items atomically", () => {
    const state = createInitialState();
    state.wallet = 5;

    expect(buyCollectible(state, "plant")).toEqual({ ok: false, reason: "INSUFFICIENT_COINS" });
    expect(state).toMatchObject({ wallet: 5, ownedCollectibles: [], displayedCollectibles: [] });
  });

  it("keeps a purchased collectible in the box without disturbing existing display slots", () => {
    const state = createInitialState();
    state.wallet = 30;
    state.ownedCollectibles = [
      "plant", "book-stand", "desk-clock", "warm-mug", "toolbox", "paper-lantern",
      "crystal", "moon-lamp", "mini-robot", "star-projector", "constellation-globe",
    ];
    state.displayedCollectibles = [...state.ownedCollectibles];

    const bought = buyCollectible(state, "comet-badge");

    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.displayedCollectibles).toHaveLength(11);
    expect(bought.state.displayedCollectibles).toEqual([
      "plant", "book-stand", "desk-clock", "warm-mug", "toolbox", "paper-lantern",
      "crystal", "moon-lamp", "mini-robot", "star-projector", "constellation-globe",
    ]);
    expect(bought.state.ownedCollectibles).toContain("comet-badge");
  });

  it("adds the twelfth unique item when legacy slots contain a duplicate", () => {
    const state = createInitialState();
    state.ownedCollectibles = [
      "plant", "book-stand", "desk-clock", "warm-mug", "toolbox", "paper-lantern",
      "crystal", "moon-lamp", "mini-robot", "star-projector", "constellation-globe", "comet-badge",
    ];
    state.displayedCollectibles = [
      "plant", "plant", "book-stand", "desk-clock", "warm-mug", "toolbox", "paper-lantern",
      "crystal", "moon-lamp", "mini-robot", "star-projector", "constellation-globe",
    ];

    expect(setCollectibleDisplayed(state, "comet-badge", true).displayedCollectibles).toEqual([
      "plant", "book-stand", "desk-clock", "warm-mug", "toolbox", "paper-lantern",
      "crystal", "moon-lamp", "mini-robot", "star-projector", "constellation-globe", "comet-badge",
    ]);
  });

  it("normalizes legacy display membership and catalog order for valid display changes", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "crystal", "moon-lamp"];
    state.displayedCollectibles = ["moon-lamp", "unknown", "crystal", "crystal", "book-stand"];

    const added = setCollectibleDisplayed(state, "plant", true);
    const removed = setCollectibleDisplayed(state, "crystal", false);

    expect(added.displayedCollectibles).toEqual(["plant", "crystal", "moon-lamp"]);
    expect(removed.displayedCollectibles).toEqual(["moon-lamp"]);
  });

  it("displays owned items in catalog order and rejects unknown or unowned items", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["crystal", "plant"];

    const shown = setCollectibleDisplayed(state, "crystal", true);
    const ordered = setCollectibleDisplayed(shown, "plant", true);

    expect(ordered.displayedCollectibles).toEqual(["plant", "crystal"]);
    expect(setCollectibleDisplayed(ordered, "unknown", true)).toBe(ordered);
    expect(setCollectibleDisplayed(ordered, "moon-lamp", true)).toBe(ordered);
  });

  it("restores catalog order when an item is removed and re-added", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "crystal", "moon-lamp"];
    state.displayedCollectibles = ["plant", "crystal", "moon-lamp"];

    const removed = setCollectibleDisplayed(state, "plant", false);
    const readded = setCollectibleDisplayed(removed, "plant", true);

    expect(readded.displayedCollectibles).toEqual(["plant", "crystal", "moon-lamp"]);
  });

  it("does not mutate its input state", () => {
    const state = createInitialState();
    state.wallet = 6;
    state.activeSpin = {
      id: "spin-immutable", stage: "payout", reels: ["coin", "coin", "coin"],
      reward: { kind: "coins", amount: 5, reason: "five-coins" },
      pityAfter: 3, createdAt: "2026-08-26T00:00:00Z",
    };
    const before = structuredClone(state);

    const settled = settleActiveSpin(state, "spin-immutable");
    const purchase = buyCollectible(state, "plant");
    const displayed = setCollectibleDisplayed(state, "plant", true);

    expect(state).toEqual(before);
    expect(settled).not.toBe(state);
    expect(purchase.ok && purchase.state).not.toBe(state);
    expect(displayed).toBe(state);
  });

  it("activates the cosmetic theme only after all three set items", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["star-projector", "constellation-globe"];

    expect(hasStarryNightTheme(state)).toBe(false);

    state.ownedCollectibles.push("comet-badge");
    expect(hasStarryNightTheme(state)).toBe(true);
  });
});
