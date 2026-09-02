import { describe, expect, it } from "vitest";
import { createInitialEcosystemState, type EcosystemState } from "../domain/types";
import {
  advanceEcosystemTo,
  boostHabitatLifecycle,
  collectHabitatProduce,
  getHabitatLifecycleView,
  reconcileEcosystemLifecycle,
} from "./lifecycle";

const at = (hours: number): Date => new Date(Date.UTC(2026, 0, 1, hours));

function syncedState(): EcosystemState {
  return advanceEcosystemTo(createInitialEcosystemState(), at(0));
}

describe("ecosystem lifecycle", () => {
  it("records the first synchronization without inventing growth or mutating the input", () => {
    const current = createInitialEcosystemState();
    const snapshot = structuredClone(current);

    const next = advanceEcosystemTo(current, at(12));

    expect(next.lifecycle.lastSimulatedAt).toBe(at(12).toISOString());
    expect(next.lifecycle.fish.goldfish.growth).toBe(0);
    expect(next.lifecycle.plots["1"].growth).toBe(0);
    expect(next.lifecycle.livestock.chick.juvenileGrowth).toBe(0);
    expect(current).toEqual(snapshot);
    expect(next).not.toBe(current);
  });

  it("grows fish by four points per effective hour and stops at adulthood", () => {
    const tenHours = advanceEcosystemTo(syncedState(), at(10));
    const adult = advanceEcosystemTo(tenHours, at(25));
    const later = advanceEcosystemTo(adult, at(100));

    expect(tenHours.lifecycle.fish.goldfish.growth).toBe(40);
    expect(adult.lifecycle.fish.goldfish.growth).toBe(100);
    expect(adult.milestones.aquarium).toBe(1);
    // The carrot reaches maturity during the same interval, so both habitats contribute.
    expect(adult.harmony).toBe(50);
    expect(later.lifecycle.fish.goldfish.growth).toBe(100);
  });

  it("doubles only the six-hour boost overlap", () => {
    const boosted = boostHabitatLifecycle(syncedState(), "aquarium", at(0));
    const next = advanceEcosystemTo(boosted, at(8));

    expect(boosted.lifecycle.fish.goldfish.boostedUntil).toBe(at(6).toISOString());
    expect(next.lifecycle.fish.goldfish.growth).toBe(56);
  });

  it("handles the exact crop maturity boundary once and waits for harvest", () => {
    const mature = advanceEcosystemTo(syncedState(), at(20));
    const waiting = advanceEcosystemTo(mature, at(44));

    expect(mature.lifecycle.plots["1"]).toMatchObject({ growth: 100, readyYield: 1 });
    expect(mature.milestones.garden).toBe(1);
    expect(waiting.lifecycle.plots["1"]).toMatchObject({ growth: 100, readyYield: 1 });
    expect(waiting.milestones.garden).toBe(1);
  });

  it("harvests a crop into inventory and immediately replants the same seed", () => {
    const mature = advanceEcosystemTo(syncedState(), at(20));

    const result = collectHabitatProduce(mature, "garden", at(20));

    expect(result.collected).toEqual([{ id: "carrot", name: "胡萝卜", count: 1, coins: 3 }]);
    expect(result.totalCoins).toBe(3);
    expect(result.ecosystem.lifecycle.produce.carrot).toBe(1);
    expect(result.ecosystem.lifecycle.plots["1"]).toMatchObject({
      seedId: "carrot-seed",
      growth: 0,
      readyYield: 0,
      generation: 2,
    });
    expect(mature.lifecycle.plots["1"].readyYield).toBe(1);
  });

  it("matures a chick, uses the remaining time to lay an egg, and stores the egg on collection", () => {
    const next = advanceEcosystemTo(syncedState(), at(54));

    expect(next.lifecycle.livestock.chick.adults).toBe(1);
    expect(next.lifecycle.livestock.chick.juveniles).toBe(0);
    expect(next.lifecycle.livestock.chick.readyProducts).toBe(1);
    expect(next.lifecycle.livestock.chick.production).toBeCloseTo(3.333333, 5);

    const result = collectHabitatProduce(next, "animals", at(54));
    expect(result.collected).toEqual([{ id: "egg", name: "鸡蛋", count: 1, coins: 3 }]);
    expect(result.totalCoins).toBe(3);
    expect(result.ecosystem.lifecycle.produce.egg).toBe(1);
    expect(result.ecosystem.lifecycle.livestock.chick.readyProducts).toBe(0);
  });

  it.each([
    ["rabbit", 2.5],
    ["alpaca", 2],
  ] as const)("adds newborn %s directly to the juvenile cohort", (id, rate) => {
    const current = syncedState();
    current.discovered.push(id);
    current.selected.animals = id;
    const reconciled = reconcileEcosystemLifecycle(current);
    reconciled.lifecycle.livestock[id] = {
      adults: 1,
      juveniles: 0,
      juvenileGrowth: 0,
      production: 100 - rate * 2,
      readyProducts: 0,
      boostedUntil: null,
      generation: 1,
    };

    const born = advanceEcosystemTo(reconciled, at(2));
    expect(born.lifecycle.livestock[id]).toMatchObject({
      adults: 1,
      juveniles: 1,
      juvenileGrowth: 0,
      production: 0,
      readyProducts: 0,
      generation: 2,
    });

    const result = collectHabitatProduce(born, "animals", at(2));
    expect(result.collected).toEqual([]);
    expect(result.totalCoins).toBe(0);
    expect(result.ecosystem.lifecycle.livestock[id]).toMatchObject({
      adults: 1,
      juveniles: 1,
      juvenileGrowth: 0,
      readyProducts: 0,
      generation: 2,
    });
  });

  it("defers newborn rabbit growth until the next simulation interval", () => {
    const current = syncedState();
    current.discovered.push("rabbit");
    const reconciled = reconcileEcosystemLifecycle(current);
    reconciled.lifecycle.livestock.rabbit = {
      adults: 1,
      juveniles: 0,
      juvenileGrowth: 0,
      production: 95,
      readyProducts: 0,
      boostedUntil: null,
      generation: 1,
    };

    const next = advanceEcosystemTo(reconciled, at(12));

    expect(next.lifecycle.livestock.rabbit).toMatchObject({
      adults: 1,
      juveniles: 1,
      juvenileGrowth: 0,
      production: 25,
      readyProducts: 0,
      generation: 2,
    });
  });

  it("keeps adult breeding active while juveniles grow and conserves cohort progress on birth", () => {
    const current = syncedState();
    current.discovered.push("rabbit");
    const reconciled = reconcileEcosystemLifecycle(current);
    reconciled.lifecycle.livestock.rabbit = {
      adults: 1,
      juveniles: 1,
      juvenileGrowth: 60,
      production: 95,
      readyProducts: 0,
      boostedUntil: null,
      generation: 1,
    };

    const next = advanceEcosystemTo(reconciled, at(12));

    expect(next.lifecycle.livestock.rabbit).toMatchObject({
      adults: 1,
      juveniles: 2,
      juvenileGrowth: 48,
      production: 25,
      readyProducts: 0,
      generation: 2,
    });
  });

  it.each(["rabbit", "alpaca"] as const)(
    "keeps the %s population bounded through twelve weekly advances",
    (id) => {
      const current = syncedState();
      current.discovered.push(id);
      let next = reconcileEcosystemLifecycle(current);
      next.lifecycle.livestock[id] = {
        adults: 1,
        juveniles: 0,
        juvenileGrowth: 0,
        production: 0,
        readyProducts: 0,
        boostedUntil: null,
        generation: 1,
      };

      for (let week = 1; week <= 12; week += 1) {
        next = advanceEcosystemTo(next, at(week * 7 * 24));
        const life = next.lifecycle.livestock[id];
        expect(life.adults + life.juveniles).toBeLessThanOrEqual(12);
      }

      expect(next.lifecycle.livestock[id].adults + next.lifecycle.livestock[id].juveniles)
        .toBe(12);
    },
  );

  it("clamps oversized legacy breeding populations during reconciliation", () => {
    const current = syncedState();
    current.discovered.push("rabbit");
    current.lifecycle.livestock.rabbit = {
      adults: 15,
      juveniles: 8,
      juvenileGrowth: 75,
      production: 90,
      readyProducts: 4,
      boostedUntil: null,
      generation: 24,
    };

    const next = reconcileEcosystemLifecycle(current);

    expect(next.lifecycle.livestock.rabbit).toMatchObject({
      adults: 12,
      juveniles: 0,
      juvenileGrowth: 0,
      production: 90,
      readyProducts: 0,
    });
  });

  it("migrates legacy uncollected offspring into the juvenile cohort without losing growth", () => {
    const current = syncedState();
    current.discovered.push("rabbit");
    const reconciled = reconcileEcosystemLifecycle(current);
    reconciled.lifecycle.livestock.rabbit = {
      adults: 1,
      juveniles: 1,
      juvenileGrowth: 60,
      production: 25,
      readyProducts: 2,
      boostedUntil: null,
      generation: 1,
    };

    const migrated = reconcileEcosystemLifecycle(reconciled);

    expect(migrated.lifecycle.livestock.rabbit).toMatchObject({
      adults: 1,
      juveniles: 3,
      juvenileGrowth: 20,
      production: 25,
      readyProducts: 0,
      generation: 3,
    });
  });

  it("matures the older cohort before adding a newborn at the same instant", () => {
    const current = syncedState();
    current.discovered.push("rabbit");
    const reconciled = reconcileEcosystemLifecycle(current);
    reconciled.lifecycle.livestock.rabbit = {
      adults: 1,
      juveniles: 1,
      juvenileGrowth: 94,
      production: 95,
      readyProducts: 0,
      boostedUntil: null,
      generation: 1,
    };

    const next = advanceEcosystemTo(reconciled, at(2));

    expect(next.lifecycle.livestock.rabbit).toMatchObject({
      adults: 2,
      juveniles: 1,
      juvenileGrowth: 0,
      production: 0,
      readyProducts: 0,
      generation: 2,
    });
  });

  it("multiplies production speed by the number of adult animals", () => {
    const current = syncedState();
    current.lifecycle.livestock.chick = {
      adults: 3,
      juveniles: 0,
      juvenileGrowth: 0,
      production: 70,
      readyProducts: 0,
      boostedUntil: null,
      generation: 1,
    };

    const next = advanceEcosystemTo(current, at(2));

    expect(next.lifecycle.livestock.chick).toMatchObject({
      adults: 3,
      production: 0,
      readyProducts: 1,
    });
  });

  it("ignores a clock rollback and preserves the latest simulation timestamp", () => {
    const current = advanceEcosystemTo(syncedState(), at(10));
    const next = advanceEcosystemTo(current, at(5));

    expect(next.lifecycle.lastSimulatedAt).toBe(at(10).toISOString());
    expect(next.lifecycle.fish.goldfish.growth).toBe(40);
  });

  it("caps one offline catch-up at seven days", () => {
    const current = syncedState();
    current.lifecycle.livestock.chick = {
      adults: 1,
      juveniles: 0,
      juvenileGrowth: 0,
      production: 0,
      readyProducts: 0,
      boostedUntil: null,
      generation: 1,
    };

    const next = advanceEcosystemTo(current, at(24 * 30));

    expect(next.lifecycle.livestock.chick.readyProducts).toBe(8);
    expect(next.lifecycle.livestock.chick.production).toBe(40);
    expect(next.lifecycle.lastSimulatedAt).toBe(at(24 * 30).toISOString());
  });

  it("never stores more than nine ready animal products", () => {
    const current = syncedState();
    current.lifecycle.livestock.chick = {
      adults: 1,
      juveniles: 0,
      juvenileGrowth: 0,
      production: 95,
      readyProducts: 9,
      boostedUntil: null,
      generation: 1,
    };

    const next = advanceEcosystemTo(current, at(100));

    expect(next.lifecycle.livestock.chick.readyProducts).toBe(9);
    expect(next.lifecycle.livestock.chick.production).toBe(95);
  });

  it("reconciles every newly discovered resident and maps six seeds to fixed plots", () => {
    const current = createInitialEcosystemState();
    current.discovered = [
      "goldfish",
      "clownfish",
      "moon-carp",
      "carrot-seed",
      "tomato-seed",
      "cabbage-seed",
      "leafy-seed",
      "star-pumpkin",
      "onion-seed",
      "chick",
      "rabbit",
      "alpaca",
    ];

    const next = reconcileEcosystemLifecycle(current);

    expect(Object.keys(next.lifecycle.fish)).toEqual(["goldfish", "clownfish", "moon-carp"]);
    expect(Object.values(next.lifecycle.plots).map((plot) => plot.seedId)).toEqual([
      "carrot-seed",
      "tomato-seed",
      "cabbage-seed",
      "leafy-seed",
      "star-pumpkin",
      "onion-seed",
    ]);
    expect(Object.keys(next.lifecycle.livestock)).toEqual(["chick", "rabbit", "alpaca"]);
    expect(next.lifecycle.livestock.rabbit).toMatchObject({ adults: 0, juveniles: 1 });
  });

  it("advances every discovered fish, crop, and animal through the same real clock", () => {
    const current = createInitialEcosystemState();
    current.discovered = [
      "goldfish",
      "clownfish",
      "moon-carp",
      "carrot-seed",
      "tomato-seed",
      "cabbage-seed",
      "leafy-seed",
      "star-pumpkin",
      "onion-seed",
      "chick",
      "rabbit",
      "alpaca",
    ];
    const synced = advanceEcosystemTo(reconcileEcosystemLifecycle(current), at(0));

    const growing = advanceEcosystemTo(synced, at(10));
    expect(Object.values(growing.lifecycle.fish).map((life) => life.growth))
      .toEqual([40, 40, 40]);
    expect(Object.values(growing.lifecycle.plots).map((plot) => plot.growth))
      .toEqual([50, 50, 50, 50, 50, 50]);
    expect(Object.values(growing.lifecycle.livestock).map((life) => life.juvenileGrowth))
      .toEqual([30, 30, 30]);

    const mature = advanceEcosystemTo(growing, at(35));
    expect(Object.values(mature.lifecycle.fish).every((life) => life.growth === 100)).toBe(true);
    expect(Object.values(mature.lifecycle.plots).every(
      (plot) => plot.growth === 100 && plot.readyYield === 1,
    )).toBe(true);
    expect(Object.values(mature.lifecycle.livestock).every(
      (life) => life.adults === 1 && life.juveniles === 0,
    )).toBe(true);
  });

  it("provides a selected habitat view with stage, progress, output, countdown, and inventory", () => {
    const current = syncedState();
    current.lifecycle.fish.goldfish.growth = 40;
    current.lifecycle.plots["1"].growth = 100;
    current.lifecycle.plots["1"].readyYield = 1;
    current.lifecycle.produce.carrot = 2;

    expect(getHabitatLifecycleView(current, "aquarium")).toMatchObject({
      id: "goldfish",
      name: "金鱼",
      stage: "growing",
      progress: 40,
      productName: null,
      inventoryCount: 0,
      remainingSecondsAtNormalSpeed: 54_000,
    });
    expect(getHabitatLifecycleView(current, "garden")).toMatchObject({
      id: "carrot-seed",
      name: "胡萝卜种子",
      stage: "ready",
      progress: 100,
      readyCount: 1,
      productName: "胡萝卜",
      inventoryCount: 2,
      remainingSecondsAtNormalSpeed: 0,
    });
  });
});
