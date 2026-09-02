import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import {
  applyEcosystemReward,
  advanceEcosystemFromWork,
  buyEcosystemItem,
  careForHabitat,
  collectHabitatProduce,
} from "./ecosystem";
import { ECOSYSTEM_RESIDENTS } from "./catalog";
import { advanceEcosystemTo } from "./lifecycle";

describe("ecosystem economy", () => {
  it("starts with one resident in each habitat and one matching supply", () => {
    const state = createInitialState();

    expect(state.ecosystem.discovered).toEqual(["goldfish", "carrot-seed", "chick"]);
    expect(state.ecosystem.selected).toEqual({
      aquarium: "goldfish",
      garden: "carrot-seed",
      animals: "chick",
    });
    expect(state.ecosystem.supplies).toEqual({ fishFeed: 1, fertilizer: 1, animalFeed: 1 });
  });

  it("uses coins to buy a new species and selects it in its habitat", () => {
    const state = createInitialState();
    state.wallet = 20;

    const result = buyEcosystemItem(state, "clownfish");

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected purchase to succeed");
    expect(result.state.wallet).toBe(8);
    expect(result.state.ecosystem.discovered).toContain("clownfish");
    expect(result.state.ecosystem.selected.aquarium).toBe("clownfish");
  });

  it("offers six garden seeds so every soil plot can be expanded separately", () => {
    const gardenSeeds = ECOSYSTEM_RESIDENTS.filter((item) => item.habitat === "garden");

    expect(gardenSeeds.map((item) => item.id)).toEqual([
      "carrot-seed",
      "tomato-seed",
      "cabbage-seed",
      "leafy-seed",
      "star-pumpkin",
      "onion-seed",
    ]);
  });

  it("allows repeat purchases of consumable feed but not duplicate residents", () => {
    const state = createInitialState();
    state.wallet = 20;

    const feed = buyEcosystemItem(state, "fish-feed");
    expect(feed).toMatchObject({ ok: true });
    if (!feed.ok) throw new Error("expected feed purchase to succeed");
    expect(feed.state.ecosystem.supplies.fishFeed).toBe(2);

    expect(buyEcosystemItem(state, "goldfish")).toEqual({ ok: false, reason: "ALREADY_OWNED" });
  });

  it("consumes one supply and starts a six-hour double-speed growth window", () => {
    const state = createInitialState();
    const now = new Date("2026-09-01T00:00:00.000Z");

    const result = careForHabitat(state, "aquarium", now);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected care to succeed");
    expect(result.state.ecosystem.supplies.fishFeed).toBe(0);
    expect(result.state.ecosystem.lifecycle.fish.goldfish?.boostedUntil)
      .toBe("2026-09-01T06:00:00.000Z");
    expect(result.state.wallet).toBe(0);

    const grown = advanceEcosystemTo(
      result.state.ecosystem,
      new Date("2026-09-01T06:00:00.000Z"),
    );
    expect(grown.lifecycle.fish.goldfish?.growth).toBe(48);
    expect(grown.progress.aquarium).toBe(48);
  });

  it("does not mutate when the matching supply is empty", () => {
    const state = createInitialState();
    state.ecosystem.supplies.fertilizer = 0;

    expect(careForHabitat(state, "garden")).toEqual({ ok: false, reason: "NO_SUPPLY" });
  });

  it("automatically converts duplicate slot residents into quality-based coins", () => {
    const state = createInitialState();

    const result = applyEcosystemReward(state, "goldfish");

    expect(result.isDuplicate).toBe(true);
    expect(result.conversionCoins).toBe(3);
    expect(result.state.wallet).toBe(3);
    expect(result.state.ecosystem.discovered).toEqual(state.ecosystem.discovered);
  });

  it("adds a new slot resident without charging coins and adds supplies by quantity", () => {
    const state = createInitialState();
    const discovered = applyEcosystemReward(state, "clownfish");
    const supplied = applyEcosystemReward(discovered.state, "fertilizer");

    expect(discovered.isDuplicate).toBe(false);
    expect(discovered.state.ecosystem.discovered).toContain("clownfish");
    expect(discovered.state.ecosystem.selected.aquarium).toBe("clownfish");
    expect(supplied.state.ecosystem.supplies.fertilizer).toBe(2);
  });

  it("lets completed work advance all three habitats without consuming supplies", () => {
    const state = createInitialState();

    const next = advanceEcosystemFromWork(state, 2);

    expect(next.ecosystem.progress).toEqual({ aquarium: 8, garden: 10, animals: 6 });
    expect(next.ecosystem.lifecycle.fish.goldfish?.growth).toBe(8);
    expect(next.ecosystem.lifecycle.plots["1"].growth).toBe(10);
    expect(next.ecosystem.lifecycle.livestock.chick?.juvenileGrowth).toBe(6);
    expect(next.ecosystem.supplies).toEqual(state.ecosystem.supplies);
  });

  it("turns large work rewards into real maturity and production events", () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.fish.goldfish!.growth = 90;
    state.ecosystem.lifecycle.plots["1"].growth = 90;
    state.ecosystem.lifecycle.livestock.chick!.juvenileGrowth = 90;

    const next = advanceEcosystemFromWork(state, 25);

    expect(next.ecosystem.progress).toEqual({ aquarium: 100, garden: 100, animals: 8 });
    expect(next.ecosystem.lifecycle.plots["1"].readyYield).toBe(1);
    expect(next.ecosystem.lifecycle.livestock.chick).toMatchObject({ adults: 1, readyProducts: 1 });
    expect(next.ecosystem.milestones).toEqual({ aquarium: 1, garden: 1, animals: 2 });
    expect(next.ecosystem.harmony).toBe(100);
  });

  it("credits harvested produce to the wallet and exposes the exact coin total", () => {
    const state = createInitialState();
    state.wallet = 7;
    state.ecosystem = advanceEcosystemTo(
      advanceEcosystemTo(state.ecosystem, new Date("2026-09-01T00:00:00.000Z")),
      new Date("2026-09-01T20:00:00.000Z"),
    );

    const result = collectHabitatProduce(
      state,
      "garden",
      new Date("2026-09-01T20:00:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCoins).toBe(3);
    expect(result.collected).toEqual([
      { id: "carrot", name: "胡萝卜", count: 1, coins: 3 },
    ]);
    expect(result.state.wallet).toBe(10);
  });

  it("rejects buying a supply when its safe storage capacity is full", () => {
    const state = createInitialState();
    state.wallet = 20;
    state.ecosystem.supplies.fishFeed = 999;

    expect(buyEcosystemItem(state, "fish-feed")).toEqual({ ok: false, reason: "ALREADY_OWNED" });
  });
});
