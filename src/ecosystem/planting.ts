import type { EcosystemPlotId, GameState } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID } from "./catalog";
import { advanceEcosystemTo } from "./lifecycle";

/** Undo only the prepaid next crop. The growing crop and its unclaimed yield stay intact. */
export function cancelPlanting(state: GameState, plotId: EcosystemPlotId):
  { ok: true; state: GameState } | { ok: false; reason: "no-planting-plan" } {
  const plots = state.ecosystem.lifecycle.plots;
  if (!Object.hasOwn(plots, plotId) || plots[plotId].nextSeedId === undefined) {
    return { ok: false, reason: "no-planting-plan" };
  }
  const plot = { ...plots[plotId] };
  delete plot.nextSeedId;
  return {
    ok: true,
    state: {
      ...state,
      ecosystem: {
        ...state.ecosystem,
        supplies: {
          ...state.ecosystem.supplies,
          fertilizer: Math.min(999, state.ecosystem.supplies.fertilizer + 1),
        },
        lifecycle: { ...state.ecosystem.lifecycle, plots: { ...plots, [plotId]: plot } },
      },
    },
  };
}

/** A seed discovery is permanent. Additional planting costs one fertilizer. */
export function plantCrop(state: GameState, plotId: EcosystemPlotId, seedId: string, now: Date):
  { ok: true; state: GameState } | { ok: false; reason: "item-not-owned" | "no-supply" | "plot-occupied" } {
  const seed = ECOSYSTEM_ITEM_BY_ID[seedId];
  if (!seed || seed.habitat !== "garden" || seed.kind !== "resident" || !state.ecosystem.discovered.includes(seedId)) {
    return { ok: false, reason: "item-not-owned" };
  }
  const ecosystem = advanceEcosystemTo(state.ecosystem, now);
  const plot = ecosystem.lifecycle.plots[plotId];
  if (!plot || plot.seedId === seedId || plot.nextSeedId !== undefined) return { ok: false, reason: "plot-occupied" };
  if (ecosystem.supplies.fertilizer < 1) return { ok: false, reason: "no-supply" };
  ecosystem.supplies.fertilizer--;
  if (plot.growth > 0 || plot.readyYield > 0) {
    // Plan the next crop; never discard a living crop or its unclaimed yield.
    plot.nextSeedId = seedId;
  } else {
    ecosystem.selected.garden = seedId;
    ecosystem.lifecycle.plots[plotId] = { seedId, growth: 0, readyYield: 0, boostedUntil: null, generation: plot.generation + 1 };
  }
  return { ok: true, state: { ...state, ecosystem } };
}
