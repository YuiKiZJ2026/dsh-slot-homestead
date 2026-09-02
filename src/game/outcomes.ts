import { COLLECTIBLES } from "../domain/catalog";
import type {
  CollectibleDefinition,
  GameState,
  Rarity,
  ReelSymbol,
  ResolvedReward,
  ResolvedSpin,
} from "../domain/types";
import type { RandomSource } from "./rng";
import { ECOSYSTEM_ITEMS, type EcosystemItemDefinition } from "../ecosystem/catalog";

const OUTCOME_BANDS = [
  [0, 0.45, "none"],
  [0.45, 0.69, "refund"],
  [0.69, 0.77, "five-coins"],
  [0.77, 0.89, "common"],
  [0.89, 0.96, "rare"],
  [0.96, 0.99, "set"],
  [0.99, 1, "robot-jackpot"],
] as const;

export type OutcomeKind = (typeof OUTCOME_BANDS)[number][2];

export type SpinCreationResult =
  | { ok: false; reason: "INSUFFICIENT_COINS" | "ACTIVE_SPIN" }
  | { ok: true; state: GameState; spin: ResolvedSpin };

type ResolvedOutcome = {
  kind: OutcomeKind;
  reward: ResolvedReward;
  pityAfter: number;
  variant: number;
};

const NONE_REEL_LAYOUTS: readonly (readonly [ReelSymbol, ReelSymbol, ReelSymbol])[] = [
  ["leaf", "crystal", "moon"],
  ["crystal", "moon", "robot"],
  ["moon", "robot", "leaf"],
  ["robot", "leaf", "crystal"],
];

const REFUND_THIRD_SYMBOLS: readonly ReelSymbol[] = ["leaf", "crystal", "moon", "robot"];

export function createPaidSpin(
  state: GameState,
  rng: RandomSource,
  now: Date,
  createId: () => string,
  forcedOutcome?: OutcomeKind | null,
): SpinCreationResult {
  if (state.activeSpin !== null) {
    return { ok: false, reason: "ACTIVE_SPIN" };
  }

  if (state.wallet < 1) {
    return { ok: false, reason: "INSUFFICIENT_COINS" };
  }

  const outcome = forcedOutcome === undefined || forcedOutcome === null
    ? resolveAutomaticOutcome(state, rng)
    : resolveForcedOutcome(state, forcedOutcome);
  const spin: ResolvedSpin = {
    id: createId(),
    stage: "coin-inserted",
    reels: reelsForOutcome(outcome.kind, outcome.variant),
    reward: outcome.reward,
    pityAfter: outcome.pityAfter,
    createdAt: now.toISOString(),
  };

  return {
    ok: true,
    state: {
      ...state,
      wallet: state.wallet - 1,
      activeSpin: spin,
    },
    spin,
  };
}

export function reelsForOutcome(
  kind: OutcomeKind,
  variant: number,
): readonly [ReelSymbol, ReelSymbol, ReelSymbol] {
  switch (kind) {
    case "none":
      return pickByVariant(NONE_REEL_LAYOUTS, variant);

    case "refund":
      return ["coin", "coin", pickByVariant(REFUND_THIRD_SYMBOLS, variant)];

    case "five-coins":
      return ["coin", "coin", "coin"];

    case "common":
      return ["leaf", "leaf", "leaf"];

    case "rare":
      return ["crystal", "crystal", "crystal"];

    case "set":
      return ["moon", "moon", "moon"];

    case "robot-jackpot":
      return ["robot", "robot", "robot"];
  }
}

function resolveAutomaticOutcome(state: GameState, rng: RandomSource): ResolvedOutcome {
  if (state.pityMisses >= 10) {
    return resolvePityOutcome(state, rng);
  }

  const kind = outcomeForRoll(rng.next());
  const variant = kind === "none" || kind === "refund" ? rng.next() : 0;

  return resolveOutcome(state, kind, rng, variant, false);
}

function resolveForcedOutcome(state: GameState, kind: OutcomeKind): ResolvedOutcome {
  return resolveOutcome(state, kind, null, 0, true);
}

function resolvePityOutcome(state: GameState, rng: RandomSource): ResolvedOutcome {
  const unownedCommon = unownedItems(state, "common");
  const unownedRare = unownedItems(state, "rare");

  if (unownedCommon.length === 0 && unownedRare.length === 0) {
    return {
      kind: "five-coins",
      reward: { kind: "coins", amount: 9, reason: "pity-fallback" },
      pityAfter: 0,
      variant: 0,
    };
  }

  const preferred = rng.next() < 0.75 ? unownedCommon : unownedRare;
  const fallback = preferred === unownedCommon ? unownedRare : unownedCommon;
  const pool = preferred.length > 0 ? preferred : fallback;
  const item = pickByVariant(pool, rng.next());
  const kind: OutcomeKind = item.rarity === "common" ? "common" : "rare";

  return {
    kind,
    reward: collectibleReward(item, false, 0),
    pityAfter: 0,
    variant: 0,
  };
}

function resolveOutcome(
  state: GameState,
  kind: OutcomeKind,
  rng: RandomSource | null,
  variant: number,
  isForced: boolean,
): ResolvedOutcome {
  switch (kind) {
    case "none":
      return { kind, reward: { kind: "none" }, pityAfter: nextPity(state), variant };

    case "refund":
      return {
        kind,
        reward: { kind: "coins", amount: 1, reason: "refund" },
        pityAfter: nextPity(state),
        variant,
      };

    case "five-coins":
      return {
        kind,
        reward: { kind: "coins", amount: 5, reason: "five-coins" },
        pityAfter: nextPity(state),
        variant,
      };

    case "common":
    case "rare":
    case "set": {
      const selectionRoll = isForced ? 0 : rng?.next() ?? 0;
      if (kind === "common" && !isForced && selectionRoll >= 0.75) {
        const habitatItem = pickByVariant(ECOSYSTEM_ITEMS, (selectionRoll - 0.75) / 0.25);
        const isDuplicate = habitatItem.kind === "resident" &&
          state.ecosystem.discovered.includes(habitatItem.id);
        return {
          kind,
          reward: ecosystemReward(habitatItem, isDuplicate),
          pityAfter: habitatItem.kind === "supply" || isDuplicate ? nextPity(state) : 0,
          variant,
        };
      }
      const item = isForced
        ? firstUnownedOrFirst(state, kind)
        : pickByVariant(itemsForOutcome(kind), selectionRoll);
      const isDuplicate = state.ownedCollectibles.includes(item.id);

      return {
        kind,
        reward: collectibleReward(item, isDuplicate, 0),
        pityAfter: isDuplicate ? nextPity(state) : 0,
        variant,
      };
    }

    case "robot-jackpot": {
      const unownedRare = unownedItems(state, "rare");

      if (unownedRare.length === 0) {
        return {
          kind,
          reward: { kind: "coins", amount: 12, reason: "robot-fallback" },
          pityAfter: nextPity(state),
          variant,
        };
      }

      const item = isForced ? unownedRare[0] : pickByVariant(unownedRare, rng?.next() ?? 0);

      return {
        kind,
        reward: collectibleReward(item, false, 3),
        pityAfter: 0,
        variant,
      };
    }
  }
}

function ecosystemReward(item: EcosystemItemDefinition, isDuplicate: boolean): ResolvedReward {
  return {
    kind: "ecosystem-item",
    itemId: item.id,
    isDuplicate,
    conversionCoins: isDuplicate ? item.duplicateCoins : 0,
  };
}

function outcomeForRoll(roll: number): OutcomeKind {
  for (const [start, end, kind] of OUTCOME_BANDS) {
    if (roll >= start && roll < end) {
      return kind;
    }
  }

  return "robot-jackpot";
}

function firstUnownedOrFirst(state: GameState, kind: "common" | "rare" | "set"): CollectibleDefinition {
  const items = itemsForOutcome(kind);
  return items.find((item) => !state.ownedCollectibles.includes(item.id)) ?? items[0];
}

function unownedItems(state: GameState, rarity: "common" | "rare"): CollectibleDefinition[] {
  return COLLECTIBLES.filter(
    (item) => item.rarity === rarity && !state.ownedCollectibles.includes(item.id),
  );
}

function itemsForOutcome(kind: "common" | "rare" | "set"): CollectibleDefinition[] {
  const rarity: Rarity = kind;
  return COLLECTIBLES.filter((item) => item.rarity === rarity);
}

function collectibleReward(
  item: CollectibleDefinition,
  isDuplicate: boolean,
  bonusCoins: number,
): ResolvedReward {
  return {
    kind: "collectible",
    collectibleId: item.id,
    isDuplicate,
    conversionCoins: isDuplicate ? item.duplicateCoins : 0,
    bonusCoins,
  };
}

function nextPity(state: GameState): number {
  return Math.min(10, state.pityMisses + 1);
}

function pickByVariant<T>(values: readonly T[], variant: number): T {
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(variant * values.length)));
  return values[index]!;
}
