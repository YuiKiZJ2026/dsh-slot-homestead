import { describe, expect, it } from "vitest";
import { createInitialState, type GameState } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID } from "./catalog";
import { collectHabitatProduce } from "./ecosystem";
import { worldDate } from "./world-clock";
import { buyFromMerchant, getMerchantSaleQuote, getMerchantView, merchantStateSchema, sellToMerchant } from "./merchant";

function at(day: number, hour = 10, seed = 5173): GameState {
  const game = createInitialState();
  game.wallet = 100;
  game.ecosystem.world = { elapsedMs: ((day - 1) * 24 + hour - 6) * 3_600_000, lastRealAt: "2026-09-07T00:00:00.000Z", seed };
  game.ecosystem.lifecycle.lastSimulatedAt = worldDate(game.ecosystem.world).toISOString();
  return game;
}

function visiting(seed = 5173): GameState {
  return at(getMerchantView(at(1, 6, seed).ecosystem).nextArrivalDay, 10, seed);
}

function readyGarden(game: GameState): void {
  game.ecosystem.discovered.push("tomato-seed", "cabbage-seed");
  game.ecosystem.lifecycle.plots["1"] = { seedId: "carrot-seed", nextSeedId: "tomato-seed", growth: 100, readyYield: 1, boostedUntil: null, generation: 2 };
  game.ecosystem.lifecycle.plots["2"] = { seedId: "cabbage-seed", growth: 41, readyYield: 0, boostedUntil: null, generation: 1 };
  game.ecosystem.lifecycle.plots["3"] = { seedId: "tomato-seed", growth: 100, readyYield: 1, boostedUntil: null, generation: 1 };
}

describe("traveling merchant schedule and inventory", () => {
  it("chooses exactly one seeded day in each three-day window, without refresh rerolls", () => {
    const first = getMerchantView(at(1, 6).ecosystem);
    expect(first.present).toBe(false);
    expect(first.nextArrivalDay).toBeGreaterThanOrEqual(2);
    expect(first.nextArrivalDay).toBeLessThanOrEqual(4);
    const visits = new Set<string>();
    const assortments = new Set<string>();
    for (let window = 0; window < 28; window++) {
      const openDays = [2, 3, 4].map(offset => at(window * 3 + offset)).filter(game => getMerchantView(game.ecosystem).present);
      expect(openDays).toHaveLength(1);
      const view = getMerchantView(openDays[0].ecosystem);
      expect(getMerchantView(structuredClone(openDays[0].ecosystem))).toEqual(view);
      expect(view.nextArrivalDay).toBeGreaterThan(view.arrivalDay);
      expect(view.departure).toEqual({ day: view.arrivalDay, hour: 20, minute: 0 });
      visits.add(view.visitId!);
      assortments.add(view.offers.filter(offer => offer.kind === "resident").map(offer => offer.itemId).sort().join(","));
    }
    expect(visits.size).toBe(28);
    expect(assortments.size).toBeGreaterThanOrEqual(5);
  });

  it("opens at 08:00 and leaves at 20:00 without granting a new same-day stock", () => {
    const day = getMerchantView(visiting().ecosystem).arrivalDay;
    expect(getMerchantView(at(day, 7.999).ecosystem).present).toBe(false);
    expect(getMerchantView(at(day, 8).ecosystem).present).toBe(true);
    expect(getMerchantView(at(day, 19.999).ecosystem).present).toBe(true);
    const closed = at(day, 20);
    const view = getMerchantView(closed.ecosystem);
    expect(view.present).toBe(false);
    expect(view.nextArrivalDay).toBeGreaterThan(day);
    expect(buyFromMerchant(closed, "fish-feed", view.visitId!)).toEqual({ ok: false, reason: "merchant-away" });
    expect(sellToMerchant(closed, "garden", view.visitId!)).toEqual({ ok: false, reason: "merchant-away" });
  });

  it("previews the actual next visit's fresh stock after departure, without allowing advance purchases", () => {
    let game = visiting();
    const current = getMerchantView(game.ecosystem);
    for (let i = 0; i < 2; i++) {
      const result = buyFromMerchant(game, "fish-feed", current.visitId!);
      if (!result.ok) throw new Error(result.reason);
      game = result.state;
    }
    game.ecosystem.world = at(current.arrivalDay, 20).ecosystem.world;
    const before = structuredClone(game);
    const preview = getMerchantView(game.ecosystem);
    expect(preview.present).toBe(false);
    expect(preview.arrivalDay).toBe(current.nextArrivalDay);
    expect(preview.nextArrivalDay).toBe(preview.arrivalDay);
    expect(preview.visitId).not.toBe(current.visitId);
    expect(preview.offers.find(offer => offer.itemId === "fish-feed")?.remaining).toBe(2);
    expect(buyFromMerchant(game, "fish-feed", current.visitId!)).toEqual({ ok: false, reason: "stale-visit" });
    expect(buyFromMerchant(game, "fish-feed", preview.visitId!)).toEqual({ ok: false, reason: "merchant-away" });
    expect(game).toEqual(before);
    game.ecosystem.world = at(preview.nextArrivalDay, 8).ecosystem.world;
    const arrived = getMerchantView(game.ecosystem);
    expect(arrived.present).toBe(true);
    expect(arrived.visitId).toBe(preview.visitId);
    expect(arrived.offers).toEqual(preview.offers);
  });

  it("stocks the three discounted supply bundles and only two common catalog residents", () => {
    const view = getMerchantView(visiting().ecosystem);
    expect(view.offers).toHaveLength(5);
    const supplies = view.offers.filter(offer => offer.kind === "supply");
    expect(supplies.map(offer => offer.itemId)).toEqual(["fish-feed", "fertilizer", "animal-feed"]);
    for (const offer of supplies) {
      expect(offer).toMatchObject({ quantity: 3, price: 4, limit: 2, remaining: 2 });
      expect(offer.price).toBeLessThan(ECOSYSTEM_ITEM_BY_ID[offer.itemId].price * offer.quantity);
    }
    for (const offer of view.offers.filter(offer => offer.kind === "resident")) {
      expect(ECOSYSTEM_ITEM_BY_ID[offer.itemId].rarity).toBe("common");
      expect(offer).toMatchObject({ quantity: 1, limit: 1 });
    }
  });

  it("keeps merchant stock across reload and never spends coins after a sold-out rejection", () => {
    let game = visiting();
    const visit = getMerchantView(game.ecosystem).visitId!;
    for (let i = 0; i < 2; i++) {
      const result = buyFromMerchant(game, "fish-feed", visit);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      game = structuredClone(result.state);
      expect(result).toMatchObject({ quantity: 3, totalCoins: 4 });
    }
    expect(game.wallet).toBe(92);
    expect(game.ecosystem.supplies.fishFeed).toBe(7);
    expect(getMerchantView(game.ecosystem).offers.find(offer => offer.itemId === "fish-feed")?.remaining).toBe(0);
    const before = structuredClone(game);
    expect(buyFromMerchant(game, "fish-feed", visit)).toEqual({ ok: false, reason: "out-of-stock" });
    expect(game).toEqual(before);
  });

  it("rejects a partial bundle at capacity without spending coins or stock", () => {
    const game = visiting();
    game.ecosystem.supplies.fertilizer = 997;
    const visit = getMerchantView(game.ecosystem).visitId!;
    const before = structuredClone(game);
    expect(buyFromMerchant(game, "fertilizer", visit)).toEqual({ ok: false, reason: "inventory-full" });
    expect(game).toEqual(before);
    game.ecosystem.supplies.fertilizer = 996;
    const result = buyFromMerchant(game, "fertilizer", visit);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.ecosystem.supplies.fertilizer).toBe(999);
  });

  it("uses server catalog prices and rejects invalid items, negative wallets and insufficient funds atomically", () => {
    const game = visiting();
    const visit = getMerchantView(game.ecosystem).visitId!;
    for (const id of ["__proto__", "constructor", "unknown", "crystal", "moon-carp", "fish-feed:0"]) {
      expect(buyFromMerchant(game, id, visit)).toEqual({ ok: false, reason: "unknown-item" });
    }
    game.wallet = 3;
    const before = structuredClone(game);
    expect(buyFromMerchant(game, "fish-feed", visit)).toEqual({ ok: false, reason: "insufficient-coins" });
    expect(game).toEqual(before);
    for (const wallet of [-1, Number.NaN, Number.POSITIVE_INFINITY, 2.5]) {
      game.wallet = wallet;
      expect(buyFromMerchant(game, "fish-feed", visit)).toEqual({ ok: false, reason: "invalid-state" });
    }
  });

  it("unlocks a catalog resident once and respects an active spin's reserved reward", () => {
    const game = visiting();
    const view = getMerchantView(game.ecosystem);
    const offer = view.offers.find(item => item.kind === "resident")!;
    game.ecosystem.discovered = game.ecosystem.discovered.filter(id => id !== offer.itemId);
    game.activeSpin = { id: "held", stage: "highlight", reels: ["leaf", "leaf", "leaf"], reward: { kind: "ecosystem-item", itemId: offer.itemId, isDuplicate: false, conversionCoins: 0 }, pityAfter: 0, createdAt: "2026-09-07T00:00:00.000Z" };
    expect(buyFromMerchant(game, offer.itemId, view.visitId!)).toEqual({ ok: false, reason: "locked-spin-reward" });
    game.activeSpin = null;
    const result = buyFromMerchant(game, offer.itemId, view.visitId!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallet).toBe(game.wallet - offer.price);
    expect(result.state.ecosystem.discovered.filter(id => id === offer.itemId)).toHaveLength(1);
    expect(result.state.ecosystem.world).toEqual(game.ecosystem.world);
    expect(buyFromMerchant(result.state, offer.itemId, view.visitId!)).toEqual({ ok: false, reason: "already-owned" });
  });

  it("rejects a previous visit command when another visit arrives, and starts only one fresh ledger", () => {
    const game = visiting();
    const view = getMerchantView(game.ecosystem);
    const purchase = buyFromMerchant(game, "fish-feed", view.visitId!);
    if (!purchase.ok) throw new Error("Expected fixture purchase");
    const next = at(view.nextArrivalDay);
    next.ecosystem.merchant = purchase.state.ecosystem.merchant;
    const nextView = getMerchantView(next.ecosystem);
    expect(nextView.visitId).not.toBe(view.visitId);
    expect(buyFromMerchant(next, "fish-feed", view.visitId!)).toEqual({ ok: false, reason: "stale-visit" });
    readyGarden(next);
    const before = structuredClone(next);
    expect(sellToMerchant(next, "garden", view.visitId!)).toEqual({ ok: false, reason: "stale-visit" });
    expect(next).toEqual(before);
    const nextPurchase = buyFromMerchant(next, "animal-feed", nextView.visitId!);
    expect(nextPurchase.ok).toBe(true);
    if (nextPurchase.ok) expect(nextPurchase.state.ecosystem.merchant?.purchased).toEqual({ "animal-feed": 1 });
  });

  it("bounds the persisted ledger and rejects unsupported stock keys and extra fields", () => {
    const visitId = getMerchantView(visiting().ecosystem).visitId!;
    expect(merchantStateSchema.safeParse({ visitId, purchased: { "fish-feed": 2, rabbit: 1 }, soldCount: 24 }).success).toBe(true);
    for (const purchased of [{ "fish-feed": 3 }, { rabbit: 2 }, { "moon-carp": 1 }, { unknown: 1 }, { "fish-feed": 1, fertilizer: 1, "animal-feed": 1, rabbit: 1, goldfish: 1, chick: 1 }]) {
      expect(merchantStateSchema.safeParse({ visitId, purchased, soldCount: 0 }).success).toBe(false);
    }
    expect(merchantStateSchema.safeParse({ visitId, purchased: {}, soldCount: 25 }).success).toBe(false);
    expect(merchantStateSchema.safeParse({ visitId, purchased: {}, soldCount: 0, oldVisits: [] }).success).toBe(false);
  });
});

describe("merchant harvest sales", () => {
  it("quotes only currently ready crops, pays base +1 per item and honors prepaid next planting", () => {
    const game = visiting();
    readyGarden(game);
    game.ecosystem.lifecycle.produce = { carrot: 44, tomato: 7 };
    const before = structuredClone(game);
    const quote = getMerchantSaleQuote(game.ecosystem, "garden");
    expect(quote).toMatchObject({ quantity: 2, baseCoins: 7, bonusCoins: 2, totalCoins: 9, remainingQuota: 24, withinLimit: true });
    const result = sellToMerchant(game, "garden", getMerchantView(game.ecosystem).visitId!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ quantity: 2, totalCoins: 9 });
    expect(result.state.wallet).toBe(109);
    expect(result.state.ecosystem.lifecycle.produce).toEqual({ carrot: 45, tomato: 8 });
    expect(result.state.ecosystem.lifecycle.plots["1"]).toEqual({ seedId: "tomato-seed", growth: 0, readyYield: 0, boostedUntil: null, generation: 3 });
    expect(result.state.ecosystem.lifecycle.plots["2"]).toEqual(before.ecosystem.lifecycle.plots["2"]);
    expect(result.state.ecosystem.lifecycle.fish).toEqual(before.ecosystem.lifecycle.fish);
    expect(result.state.ecosystem.lifecycle.livestock).toEqual(before.ecosystem.lifecycle.livestock);
    expect(result.state.ecosystem.journal?.harvests).toBe(2);
    expect(game).toEqual(before);
    expect(collectHabitatProduce(result.state, "garden", worldDate(game.ecosystem.world))).toEqual({ ok: false, reason: "NOTHING_TO_COLLECT" });
  });

  it("sells eggs only, never live babies or already-paid historical produce", () => {
    const game = visiting();
    game.ecosystem.lifecycle.livestock.chick.readyProducts = 4;
    game.ecosystem.lifecycle.livestock.rabbit = { adults: 2, juveniles: 1, juvenileGrowth: 20, production: 18, readyProducts: 2, boostedUntil: null, generation: 3 };
    game.ecosystem.lifecycle.produce = { egg: 99, "rabbit-kit": 8, "alpaca-cria": 2 };
    const rabbit = structuredClone(game.ecosystem.lifecycle.livestock.rabbit);
    expect(getMerchantSaleQuote(game.ecosystem, "animals")).toMatchObject({ quantity: 4, baseCoins: 12, bonusCoins: 4, totalCoins: 16 });
    const result = sellToMerchant(game, "animals", getMerchantView(game.ecosystem).visitId!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallet).toBe(116);
    expect(result.state.ecosystem.lifecycle.livestock.chick.readyProducts).toBe(0);
    expect(result.state.ecosystem.lifecycle.livestock.rabbit).toEqual(rabbit);
    expect(result.state.ecosystem.lifecycle.produce).toEqual({ egg: 103, "rabbit-kit": 8, "alpaca-cria": 2 });
    expect(sellToMerchant(result.state, "animals", getMerchantView(game.ecosystem).visitId!)).toEqual({ ok: false, reason: "nothing-to-harvest" });
  });

  it("refuses the whole sale above the combined per-visit quota, leaving all ready produce intact", () => {
    const game = visiting();
    readyGarden(game);
    const visit = getMerchantView(game.ecosystem).visitId!;
    game.ecosystem.merchant = { visitId: visit, purchased: {}, soldCount: 23 };
    expect(getMerchantSaleQuote(game.ecosystem, "garden")).toMatchObject({ quantity: 2, remainingQuota: 1, withinLimit: false });
    const before = structuredClone(game);
    expect(sellToMerchant(game, "garden", visit)).toEqual({ ok: false, reason: "trade-limit" });
    expect(game).toEqual(before);
    game.ecosystem.merchant.soldCount = 22;
    const result = sellToMerchant(game, "garden", visit);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ecosystem.merchant?.soldCount).toBe(24);
    result.state.ecosystem.lifecycle.livestock.chick.readyProducts = 1;
    expect(sellToMerchant(result.state, "animals", visit)).toEqual({ ok: false, reason: "trade-limit" });
  });

  it("rejects invalid habitats, unsafe wallet additions and invalid ledgers without mutations", () => {
    const game = visiting();
    readyGarden(game);
    const visit = getMerchantView(game.ecosystem).visitId!;
    expect(sellToMerchant(game, "aquarium" as "garden", visit)).toEqual({ ok: false, reason: "invalid-habitat" });
    game.wallet = Number.MAX_SAFE_INTEGER - 1;
    const before = structuredClone(game);
    expect(sellToMerchant(game, "garden", visit)).toEqual({ ok: false, reason: "invalid-state" });
    expect(game).toEqual(before);
    game.wallet = 100;
    game.ecosystem.merchant = { visitId: visit, purchased: { "fish-feed": -1 }, soldCount: 0 };
    expect(buyFromMerchant(game, "fish-feed", visit)).toEqual({ ok: false, reason: "invalid-state" });
  });

  it("keeps a single small ledger over twelve weeks of purchasing and selling", () => {
    let game = visiting();
    let visits = 0;
    for (let day = 2; day <= 85; day++) {
      game.ecosystem.world = at(day).ecosystem.world;
      game.ecosystem.lifecycle.lastSimulatedAt = worldDate(game.ecosystem.world).toISOString();
      const view = getMerchantView(game.ecosystem);
      if (!view.present) continue;
      visits++;
      game.wallet = 1000;
      for (const offer of view.offers.filter(offer => offer.kind === "supply")) {
        const result = buyFromMerchant(game, offer.itemId, view.visitId!);
        if (!result.ok) throw new Error(result.reason);
        game = result.state;
      }
      game.ecosystem.lifecycle.plots["1"].growth = 100;
      game.ecosystem.lifecycle.plots["1"].readyYield = 1;
      const sale = sellToMerchant(game, "garden", view.visitId!);
      if (!sale.ok) throw new Error(sale.reason);
      game = sale.state;
      expect(Object.keys(game.ecosystem.merchant!.purchased).length).toBeLessThanOrEqual(5);
      expect(JSON.stringify(game.ecosystem.merchant).length).toBeLessThan(240);
      expect(game.ecosystem.merchant!.soldCount).toBe(1);
      expect(Object.values(game.ecosystem.supplies).every(count => count <= 999)).toBe(true);
    }
    expect(visits).toBe(28);
  });
});
