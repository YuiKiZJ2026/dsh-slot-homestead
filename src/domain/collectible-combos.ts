import { legacyPlacements } from "./table-positions";
import type { GameState } from "./types";

export interface CollectibleCombo {
  readonly id: "focus-nook" | "night-light" | "workshop-buddy";
  readonly name: string;
  readonly itemIds: readonly string[];
}

export interface CollectibleComboProgress {
  readonly combo: CollectibleCombo;
  readonly displayedCount: number;
  readonly totalCount: number;
  readonly missingItemIds: string[];
}

export const COLLECTIBLE_COMBOS: readonly CollectibleCombo[] = [
  { id: "focus-nook", name: "静谧书桌", itemIds: ["plant", "book-stand"] },
  { id: "night-light", name: "暖夜灯组", itemIds: ["paper-lantern", "moon-lamp"] },
  { id: "workshop-buddy", name: "工坊伙伴", itemIds: ["toolbox", "mini-robot"] },
];

export function activeCollectibleCombos(state: GameState): CollectibleCombo[] {
  return combosForDisplayed(displayedItemIds(state));
}

export function closestCollectibleCombo(state: GameState): CollectibleComboProgress | null {
  const displayed = new Set(displayedItemIds(state));
  const incomplete = COLLECTIBLE_COMBOS
    .map((combo) => progressFor(combo, displayed))
    .filter((progress) => progress.displayedCount < progress.totalCount)
    .sort((left, right) => (
      right.displayedCount - left.displayedCount || left.totalCount - right.totalCount
    ));
  return incomplete[0] ?? null;
}

export function comboIdsForDisplayed(displayed: readonly string[]): CollectibleCombo["id"][] {
  return combosForDisplayed(displayed).map((combo) => combo.id);
}

function combosForDisplayed(displayed: readonly string[]): CollectibleCombo[] {
  const ids = new Set(displayed);
  return COLLECTIBLE_COMBOS.filter((combo) => combo.itemIds.every((id) => ids.has(id)));
}

function progressFor(
  combo: CollectibleCombo,
  displayed: ReadonlySet<string>,
): CollectibleComboProgress {
  const missingItemIds = combo.itemIds.filter((id) => !displayed.has(id));
  return {
    combo,
    displayedCount: combo.itemIds.length - missingItemIds.length,
    totalCount: combo.itemIds.length,
    missingItemIds,
  };
}

function displayedItemIds(state: GameState): string[] {
  const placements = state.tablePlacements.length > 0
    ? state.tablePlacements
    : legacyPlacements(state.displayedCollectibles);
  return placements.map((placement) => placement.itemId);
}
