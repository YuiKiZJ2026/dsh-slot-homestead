import type { CollectibleDefinition, Rarity } from "./types";

export type { CollectibleDefinition } from "./types";

const RARITY_PRICES: Record<Rarity, readonly [price: number, duplicateCoins: number]> = {
  common: [6, 3],
  rare: [18, 9],
  set: [30, 15],
};

const COLLECTIBLE_ENTRIES = [
  ["plant", "小盆栽", "common", "idle-animation"],
  ["book-stand", "书本底座", "common", "idle-animation"],
  ["desk-clock", "桌面时钟", "common", "idle-animation"],
  ["warm-mug", "热饮杯", "common", "particle"],
  ["toolbox", "迷你工具箱", "common", "idle-animation"],
  ["paper-lantern", "纸灯笼", "common", "particle"],
  ["crystal", "发光水晶", "rare", "particle"],
  ["moon-lamp", "月亮灯", "rare", "sound"],
  ["mini-robot", "迷你机器人", "rare", "idle-animation"],
  ["star-projector", "星星投影仪", "set", "theme"],
  ["constellation-globe", "星座球", "set", "theme"],
  ["comet-badge", "彗星徽章", "set", "theme"],
] as const;

export const COLLECTIBLES: readonly CollectibleDefinition[] = COLLECTIBLE_ENTRIES.map(
  ([id, name, rarity, effectKind]) => {
    const [price, duplicateCoins] = RARITY_PRICES[rarity];
    return {
      id,
      name,
      rarity,
      price,
      duplicateCoins,
      effect: { kind: effectKind },
    };
  },
);

export const CATALOG_BY_ID: Readonly<Record<string, CollectibleDefinition>> = Object.fromEntries(
  COLLECTIBLES.map((item) => [item.id, item]),
);

export function itemsByRarity(rarity: Rarity): readonly CollectibleDefinition[] {
  return COLLECTIBLES.filter((item) => item.rarity === rarity);
}
