import { describe, expect, it } from "vitest";
import { COLLECTIBLES } from "./catalog";
import { createInitialState } from "./types";

describe("collectible catalog", () => {
  it("contains exactly six common, three rare, and three set items", () => {
    expect(COLLECTIBLES).toHaveLength(12);
    expect(COLLECTIBLES.filter((item) => item.rarity === "common")).toHaveLength(6);
    expect(COLLECTIBLES.filter((item) => item.rarity === "rare")).toHaveLength(3);
    expect(COLLECTIBLES.filter((item) => item.rarity === "set")).toHaveLength(3);
    expect(new Set(COLLECTIBLES.map((item) => item.id)).size).toBe(12);
  });

  it("uses approved prices and cosmetic-only effects", () => {
    for (const item of COLLECTIBLES) {
      const expected = {
        common: { price: 6, duplicateCoins: 3 },
        rare: { price: 18, duplicateCoins: 9 },
        set: { price: 30, duplicateCoins: 15 },
      }[item.rarity];
      expect(item.price).toBe(expected.price);
      expect(item.duplicateCoins).toBe(expected.duplicateCoins);
      expect(item.effect.kind).toMatch(/^(idle-animation|particle|sound|theme)$/);
    }
  });

  it("starts with an empty wallet before the daily-open grant", () => {
    const state = createInitialState();
    expect(state.wallet).toBe(0);
    expect(state.pityMisses).toBe(0);
    expect(state.activeSpin).toBeNull();
    expect(state.ownedCollectibles).toEqual([]);
  });
});
