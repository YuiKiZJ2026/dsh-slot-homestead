import { CATALOG_BY_ID, COLLECTIBLES } from "../domain/catalog";
import type { GameState } from "../domain/types";

const DISPLAY_SLOT_LIMIT = 12;
const STARRY_NIGHT_SET = ["star-projector", "constellation-globe", "comet-badge"] as const;

export type PurchaseResult =
  | { ok: true; state: GameState }
  | {
      ok: false;
      reason: "UNKNOWN_ITEM" | "ALREADY_OWNED" | "INSUFFICIENT_COINS" | "LOCKED_SPIN_REWARD";
    };

export function settleActiveSpin(state: GameState, spinId: string): GameState {
  const spin = state.activeSpin;
  if (spin === null || spin.id !== spinId || spin.stage === "settled") {
    return state;
  }

  let wallet = state.wallet;
  let ownedCollectibles = state.ownedCollectibles;
  let displayedCollectibles = state.displayedCollectibles;

  switch (spin.reward.kind) {
    case "coins":
      wallet += spin.reward.amount;
      break;

    case "collectible":
      wallet += spin.reward.conversionCoins + spin.reward.bonusCoins;
      if (!spin.reward.isDuplicate && !ownedCollectibles.includes(spin.reward.collectibleId)) {
        ownedCollectibles = orderByCatalog([...ownedCollectibles, spin.reward.collectibleId]);
        displayedCollectibles = addToDisplay(displayedCollectibles, spin.reward.collectibleId, ownedCollectibles);
      }
      break;

    case "none":
      break;
  }

  return {
    ...state,
    wallet,
    pityMisses: spin.pityAfter,
    ownedCollectibles,
    displayedCollectibles,
    activeSpin: { ...spin, stage: "settled" },
  };
}

export function buyCollectible(state: GameState, id: string): PurchaseResult {
  const collectible = CATALOG_BY_ID[id];
  if (collectible === undefined) {
    return { ok: false, reason: "UNKNOWN_ITEM" };
  }

  if (state.ownedCollectibles.includes(id)) {
    return { ok: false, reason: "ALREADY_OWNED" };
  }

  if (isCollectibleLockedByActiveSpin(state, id)) {
    return { ok: false, reason: "LOCKED_SPIN_REWARD" };
  }

  if (state.wallet < collectible.price) {
    return { ok: false, reason: "INSUFFICIENT_COINS" };
  }

  const ownedCollectibles = orderByCatalog([...state.ownedCollectibles, id]);
  return {
    ok: true,
    state: {
      ...state,
      wallet: state.wallet - collectible.price,
      ownedCollectibles,
      displayedCollectibles: addToDisplay(state.displayedCollectibles, id, ownedCollectibles),
    },
  };
}

export function setCollectibleDisplayed(state: GameState, id: string, displayed: boolean): GameState {
  if (CATALOG_BY_ID[id] === undefined || !state.ownedCollectibles.includes(id)) {
    return state;
  }

  const normalizedDisplay = normalizeDisplayed(state.ownedCollectibles, state.displayedCollectibles);
  const displayedCollectibles = displayed
    ? addToDisplay(normalizedDisplay, id, state.ownedCollectibles)
    : normalizedDisplay.filter((displayedId) => displayedId !== id);

  if (sameIds(displayedCollectibles, state.displayedCollectibles)) {
    return state;
  }

  return { ...state, displayedCollectibles };
}

export function hasStarryNightTheme(state: GameState): boolean {
  return STARRY_NIGHT_SET.every((id) => state.ownedCollectibles.includes(id));
}

export function isCollectibleLockedByActiveSpin(state: GameState, id: string): boolean {
  const spin = state.activeSpin;
  return spin !== null &&
    spin.stage !== "settled" &&
    spin.reward.kind === "collectible" &&
    !spin.reward.isDuplicate &&
    spin.reward.collectibleId === id;
}

function addToDisplay(
  displayedCollectibles: readonly string[],
  id: string,
  ownedCollectibles: readonly string[],
): string[] {
  const normalizedDisplay = normalizeDisplayed(ownedCollectibles, displayedCollectibles);
  if (normalizedDisplay.includes(id) || normalizedDisplay.length >= DISPLAY_SLOT_LIMIT) {
    return normalizedDisplay;
  }

  return normalizeDisplayed(ownedCollectibles, [...normalizedDisplay, id]);
}

function normalizeDisplayed(ownedCollectibles: readonly string[], displayedCollectibles: readonly string[]): string[] {
  const ownedIds = new Set(ownedCollectibles);
  const displayedIds = new Set(displayedCollectibles);
  return COLLECTIBLES
    .filter((item) => ownedIds.has(item.id) && displayedIds.has(item.id))
    .map((item) => item.id);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function orderByCatalog(ids: readonly string[]): string[] {
  const selectedIds = new Set(ids);
  return COLLECTIBLES.filter((item) => selectedIds.has(item.id)).map((item) => item.id);
}
