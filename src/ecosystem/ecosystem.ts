import type { EcosystemState, GameState, HabitatId } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID } from "./catalog";
import {
  advanceEcosystemByWork,
  advanceEcosystemTo,
  boostHabitatLifecycle,
  collectHabitatProduce as collectLifecycleProduce,
  reconcileEcosystemLifecycle,
} from "./lifecycle";

export type EcosystemPurchaseResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: "UNKNOWN_ITEM" | "ALREADY_OWNED" | "INSUFFICIENT_COINS" | "LOCKED_SPIN_REWARD" };

export type HabitatCareResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: "NO_SUPPLY" };

export type HabitatCollectResult =
  | {
      ok: true;
      state: GameState;
      collected: readonly { id: string; name: string; count: number; coins: number }[];
      totalCoins: number;
    }
  | { ok: false; reason: "NOTHING_TO_COLLECT" };

const HABITAT_SUPPLY = {
  aquarium: "fishFeed",
  garden: "fertilizer",
  animals: "animalFeed",
} as const;
const MAX_SUPPLY_COUNT = 999;

export function buyEcosystemItem(state: GameState, id: string): EcosystemPurchaseResult {
  const item = ECOSYSTEM_ITEM_BY_ID[id];
  if (item === undefined) return { ok: false, reason: "UNKNOWN_ITEM" };
  if (item.kind === "resident" && state.ecosystem.discovered.includes(id)) {
    return { ok: false, reason: "ALREADY_OWNED" };
  }
  if (item.kind === "supply" && state.ecosystem.supplies[item.supplyKey!] >= MAX_SUPPLY_COUNT) {
    return { ok: false, reason: "ALREADY_OWNED" };
  }
  if (isEcosystemItemLockedByActiveSpin(state, id)) {
    return { ok: false, reason: "LOCKED_SPIN_REWARD" };
  }
  if (state.wallet < item.price) return { ok: false, reason: "INSUFFICIENT_COINS" };

  let ecosystem = cloneEcosystem(state);
  if (item.kind === "supply") {
    const supplyKey = item.supplyKey!;
    ecosystem.supplies[supplyKey] = Math.min(
      MAX_SUPPLY_COUNT,
      ecosystem.supplies[supplyKey] + 1,
    );
  } else {
    ecosystem.discovered.push(item.id);
    ecosystem.selected[item.habitat] = item.id;
    ecosystem = reconcileEcosystemLifecycle(ecosystem);
  }
  return { ok: true, state: { ...state, wallet: state.wallet - item.price, ecosystem } };
}

export function isEcosystemItemLockedByActiveSpin(state: GameState, id: string): boolean {
  const spin = state.activeSpin;
  return spin !== null &&
    spin.stage !== "settled" &&
    spin.reward.kind === "ecosystem-item" &&
    !spin.reward.isDuplicate &&
    spin.reward.itemId === id;
}

export function careForHabitat(
  state: GameState,
  habitat: HabitatId,
  now = new Date(),
): HabitatCareResult {
  const supplyKey = HABITAT_SUPPLY[habitat];
  if (state.ecosystem.supplies[supplyKey] <= 0) return { ok: false, reason: "NO_SUPPLY" };
  const ecosystem = boostHabitatLifecycle(state.ecosystem, habitat, now);
  ecosystem.supplies[supplyKey] -= 1;
  return {
    ok: true,
    state: {
      ...state,
      ecosystem,
    },
  };
}

export function collectHabitatProduce(
  state: GameState,
  habitat: Extract<HabitatId, "garden" | "animals">,
  now = new Date(),
): HabitatCollectResult {
  const result = collectLifecycleProduce(state.ecosystem, habitat, now);
  if (result.collected.length === 0) return { ok: false, reason: "NOTHING_TO_COLLECT" };
  return {
    ok: true,
    state: {
      ...state,
      wallet: state.wallet + result.totalCoins,
      ecosystem: result.ecosystem,
    },
    collected: result.collected,
    totalCoins: result.totalCoins,
  };
}

export function synchronizeEcosystem(state: GameState, now: Date): GameState {
  return { ...state, ecosystem: advanceEcosystemTo(state.ecosystem, now) };
}

export function advanceEcosystemFromWork(state: GameState, workUnits = 1): GameState {
  if (!Number.isSafeInteger(workUnits) || workUnits <= 0) return state;
  return { ...state, ecosystem: advanceEcosystemStateFromWork(state.ecosystem, workUnits) };
}

export function advanceEcosystemStateFromWork(
  current: EcosystemState,
  workUnits = 1,
): EcosystemState {
  if (!Number.isSafeInteger(workUnits) || workUnits <= 0) return current;
  return advanceEcosystemByWork(current, workUnits);
}

export function applyEcosystemReward(
  state: GameState,
  itemId: string,
  lockedConversionCoins?: number,
): { state: GameState; isDuplicate: boolean; conversionCoins: number } {
  const item = ECOSYSTEM_ITEM_BY_ID[itemId];
  if (item === undefined) return { state, isDuplicate: false, conversionCoins: 0 };
  const ecosystem = cloneEcosystem(state);
  if (item.kind === "supply") {
    ecosystem.supplies[item.supplyKey!] = Math.min(
      MAX_SUPPLY_COUNT,
      ecosystem.supplies[item.supplyKey!] + 1,
    );
    return { state: { ...state, ecosystem }, isDuplicate: false, conversionCoins: 0 };
  }
  const isDuplicate = ecosystem.discovered.includes(item.id);
  if (isDuplicate) {
    const conversionCoins = lockedConversionCoins ?? item.duplicateCoins;
    return {
      state: { ...state, wallet: state.wallet + conversionCoins },
      isDuplicate: true,
      conversionCoins,
    };
  }
  ecosystem.discovered.push(item.id);
  ecosystem.selected[item.habitat] = item.id;
  return {
    state: { ...state, ecosystem: reconcileEcosystemLifecycle(ecosystem) },
    isDuplicate: false,
    conversionCoins: 0,
  };
}

function cloneEcosystem(state: GameState): GameState["ecosystem"] {
  return cloneEcosystemState(state.ecosystem);
}

function cloneEcosystemState(ecosystem: EcosystemState): EcosystemState {
  return {
    discovered: [...ecosystem.discovered],
    selected: { ...ecosystem.selected },
    supplies: { ...ecosystem.supplies },
    progress: { ...ecosystem.progress },
    milestones: { ...ecosystem.milestones },
    harmony: ecosystem.harmony,
    lifecycle: structuredClone(ecosystem.lifecycle),
  };
}
