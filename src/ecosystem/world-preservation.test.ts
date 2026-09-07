import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { buyEcosystemItem, careForHabitat, applyEcosystemReward } from "./ecosystem";
import { reconcileEcosystemLifecycle } from "./lifecycle";
import { journalForDay, recordJournalCare } from "./journal";

describe("庄园状态不会因普通生态操作丢失", () => {
  it("preserves the world clock and merchant ledger through cloning paths", () => {
    const state = createInitialState();
    state.wallet = 30;
    state.ecosystem.world = { elapsedMs: 0, lastRealAt: "2026-09-07T00:00:00.000Z", seed: 42 };
    state.ecosystem.merchant = { visitId: "merchant-42-2", purchased: { "fish-feed": 1 }, soldCount: 2 };
    const bought = buyEcosystemItem(state, "fish-feed");
    const cared = careForHabitat(state, "aquarium", new Date("2000-01-01T06:00:00Z"));
    const outcomes = [reconcileEcosystemLifecycle(state.ecosystem), applyEcosystemReward(state, "fish-feed").state.ecosystem,
      bought.ok ? bought.state.ecosystem : null, cared.ok ? cared.state.ecosystem : null];
    for (const result of outcomes) {
      expect(result?.world).toEqual(state.ecosystem.world);
      expect(result?.merchant).toEqual(state.ecosystem.merchant);
      expect(result?.merchant).not.toBe(state.ecosystem.merchant);
    }
  });
  it("journal rolls over on game midnight, not computer midnight", () => {
    const ecosystem = createInitialState().ecosystem;
    ecosystem.world = { elapsedMs: 17 * 3600000, lastRealAt: "2026-09-07T00:00:00.000Z", seed: 42 };
    const care = recordJournalCare(ecosystem, "aquarium", new Date("2026-09-07T12:00:00Z"));
    expect(care.journal?.day).toBe("2000-01-01");
    expect(journalForDay(care, new Date("2030-01-01T12:00:00Z")).care).toEqual(["aquarium"]);
    care.world!.elapsedMs = 18 * 3600000;
    expect(journalForDay(care, new Date("2026-09-07T12:00:00Z"))).toMatchObject({day:"2000-01-02",care:[]});
  });
});
