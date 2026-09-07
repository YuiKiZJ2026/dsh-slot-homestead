import { describe, it, expect } from "vitest";
import { createInitialState } from "../domain/types";
import { claimJournalReward, getJournalQuests, recordJournalCare, recordJournalHarvest } from "./journal";
import { plantCrop } from "./planting";
import { advanceEcosystemTo, reconcileEcosystemLifecycle, collectHabitatProduce } from "./lifecycle";

const now = new Date("2026-09-05T04:00:00Z");
describe("庄园手账", () => {
  it("keeps twelve weeks of daily activity bounded and limits daily coin rewards", () => {
    let state = createInitialState();
    for (let day = 0; day < 84; day++) {
      const date = new Date(now.getTime() + day * 86400000);
      for (const habitat of ["aquarium", "garden", "animals"] as const) state.ecosystem = recordJournalCare(state.ecosystem, habitat, date);
      state.ecosystem = recordJournalHarvest(state.ecosystem, 12, date);
      for (const id of ["daily-care", "daily-round", "daily-harvest"]) {
        const result = claimJournalReward(state, id, date);
        expect(result.ok).toBe(true);
        if (result.ok) state = result.state;
        expect(claimJournalReward(state, id, date).ok).toBe(false);
      }
      expect(JSON.stringify(state.ecosystem.journal).length).toBeLessThan(300);
    }
    expect(state.wallet).toBe(84 * 3);
    expect(state.ecosystem.journal?.xp).toBe(84 * 45);
  });
  it("requires a completed objective and never grants the same reward twice", () => {
    const initial = createInitialState();
    expect(claimJournalReward(initial, "daily-care", now).ok).toBe(false);
    initial.ecosystem = recordJournalCare(initial.ecosystem, "aquarium", now);
    const result = claimJournalReward(initial, "daily-care", now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ecosystem.journal?.xp).toBe(10);
    expect(result.state.ecosystem.supplies.fishFeed).toBe(2);
    expect(claimJournalReward(result.state, "daily-care", now).ok).toBe(false);
    expect(initial.ecosystem.supplies.fishFeed).toBe(1);
  });
  it("uses distinct habitats, caps counters, and cannot reset via clock rollback", () => {
    let state = createInitialState();
    for (let i = 0; i < 100; i++) state.ecosystem = recordJournalCare(state.ecosystem, "garden", now);
    expect(getJournalQuests(state, now).find(q => q.id === "daily-round")?.progress).toBe(1);
    state.ecosystem = recordJournalHarvest(state.ecosystem, 9000, now);
    expect(state.ecosystem.journal?.harvests).toBe(3);
    const previous = new Date(now.getTime() - 86400000);
    expect(claimJournalReward(state, "daily-harvest", previous).ok).toBe(false);
    const next = new Date(now.getTime() + 86400000);
    expect(getJournalQuests(state, next).find(q => q.id === "daily-round")?.progress).toBe(0);
  });
  it("tracks lifetime milestones from the existing save and clamps supplies", () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.fish.goldfish.growth = 100;
    state.ecosystem.supplies.fishFeed = 999;
    const result = claimJournalReward(state, "first-adult", now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ecosystem.supplies.fishFeed).toBe(999);
    expect(claimJournalReward(result.state, "first-adult", new Date(now.getTime() + 86400000)).ok).toBe(false);
  });
});

describe("自由播种", () => {
  it("plans a different next crop without losing the current crop or yield", () => {
    const state = createInitialState();
    state.ecosystem.discovered.push("tomato-seed");
    state.ecosystem.lifecycle.plots["1"].growth = 100;
    state.ecosystem.lifecycle.plots["1"].readyYield = 1;
    const plan = plantCrop(state, "1", "tomato-seed", now);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.state.ecosystem.lifecycle.plots["1"]).toMatchObject({ seedId: "carrot-seed", readyYield: 1, nextSeedId: "tomato-seed" });
    const harvest = collectHabitatProduce(plan.state.ecosystem, "garden", now);
    expect(harvest.totalCoins).toBe(3);
    expect(harvest.ecosystem.lifecycle.plots["1"]).toMatchObject({ seedId: "tomato-seed", growth: 0, readyYield: 0 });
    expect(harvest.ecosystem.lifecycle.plots["1"].nextSeedId).toBeUndefined();
  });
  it("plants an unlocked seed, charges one fertilizer and retains it across reconciliation and time", () => {
    const state = createInitialState();
    const result = plantCrop(state, "2", "carrot-seed", now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ecosystem.supplies.fertilizer).toBe(0);
    expect(reconcileEcosystemLifecycle(result.state.ecosystem).lifecycle.plots["2"].seedId).toBe("carrot-seed");
    const grown = advanceEcosystemTo(result.state.ecosystem, new Date(now.getTime() + 20 * 3600000));
    expect(grown.lifecycle.plots["2"].readyYield).toBe(1);
    expect(state.ecosystem.lifecycle.plots["2"].seedId).toBeNull();
  });
  it("rejects locked seeds, non-crops, insufficient supplies, and replacing live crops", () => {
    const state = createInitialState();
    expect(plantCrop(state, "2", "tomato-seed", now).ok).toBe(false);
    expect(plantCrop(state, "2", "goldfish", now).ok).toBe(false);
    state.ecosystem.lifecycle.plots["1"].growth = 1;
    expect(plantCrop(state, "1", "carrot-seed", now).ok).toBe(false);
    state.ecosystem.supplies.fertilizer = 0;
    expect(plantCrop(state, "2", "carrot-seed", now).ok).toBe(false);
  });
});
