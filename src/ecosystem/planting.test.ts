import { describe, expect, it } from "vitest";
import { createInitialState, type EcosystemPlotId } from "../domain/types";
import { cancelPlanting, plantCrop } from "./planting";

const now = new Date("2026-09-07T04:00:00Z");

describe("cancel next-crop planting", () => {
  it.each([35, 100])("refunds a paid plan without changing the crop at %i percent growth", (growth) => {
    const initial = createInitialState();
    initial.ecosystem.discovered.push("tomato-seed");
    initial.ecosystem.lifecycle.plots["1"].growth = growth;
    initial.ecosystem.lifecycle.plots["1"].readyYield = growth === 100 ? 1 : 0;
    initial.ecosystem.lifecycle.plots["1"].boostedUntil = "2026-09-07T10:00:00Z";
    const planned = plantCrop(initial, "1", "tomato-seed", now);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const before = structuredClone(planned.state);
    const result = cancelPlanting(planned.state, "1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = structuredClone(before);
    delete expected.ecosystem.lifecycle.plots["1"].nextSeedId;
    expected.ecosystem.supplies.fertilizer++;
    expect(result.state).toEqual(expected);
    expect(planned.state).toEqual(before);
    expect(Object.hasOwn(result.state.ecosystem.lifecycle.plots["1"], "nextSeedId")).toBe(false);
    expect(cancelPlanting(result.state, "1")).toEqual({ ok: false, reason: "no-planting-plan" });
  });

  it("caps the refund at 999 and leaves the original save untouched", () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.plots["1"].nextSeedId = "carrot-seed";
    state.ecosystem.supplies.fertilizer = 999;
    const result = cancelPlanting(state, "1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ecosystem.supplies.fertilizer).toBe(999);
    expect(state.ecosystem.lifecycle.plots["1"].nextSeedId).toBe("carrot-seed");
  });

  it("rejects absent plans and forged plot identifiers without any changes", () => {
    const state = createInitialState();
    const before = structuredClone(state);
    for (const id of ["1", "2", "0", "7", "__proto__", "constructor"]) {
      expect(cancelPlanting(state, id as EcosystemPlotId)).toEqual({ ok: false, reason: "no-planting-plan" });
    }
    expect(state).toEqual(before);
  });
});
