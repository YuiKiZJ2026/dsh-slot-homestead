import type { EcosystemSupplyKey, HabitatId, Rarity } from "../domain/types";

export interface EcosystemItemDefinition {
  id: string;
  name: string;
  habitat: HabitatId;
  kind: "resident" | "supply";
  rarity: Rarity;
  price: number;
  duplicateCoins: number;
  supplyKey?: EcosystemSupplyKey;
}

export const ECOSYSTEM_ITEMS: readonly EcosystemItemDefinition[] = [
  { id: "goldfish", name: "金鱼", habitat: "aquarium", kind: "resident", rarity: "common", price: 6, duplicateCoins: 3 },
  { id: "clownfish", name: "小丑鱼", habitat: "aquarium", kind: "resident", rarity: "rare", price: 12, duplicateCoins: 6 },
  { id: "moon-carp", name: "月光锦鲤", habitat: "aquarium", kind: "resident", rarity: "set", price: 24, duplicateCoins: 12 },
  { id: "carrot-seed", name: "胡萝卜种子", habitat: "garden", kind: "resident", rarity: "common", price: 5, duplicateCoins: 3 },
  { id: "tomato-seed", name: "番茄种子", habitat: "garden", kind: "resident", rarity: "common", price: 8, duplicateCoins: 4 },
  { id: "cabbage-seed", name: "卷心菜种子", habitat: "garden", kind: "resident", rarity: "common", price: 10, duplicateCoins: 5 },
  { id: "leafy-seed", name: "青菜种子", habitat: "garden", kind: "resident", rarity: "common", price: 12, duplicateCoins: 6 },
  { id: "star-pumpkin", name: "星光南瓜", habitat: "garden", kind: "resident", rarity: "rare", price: 15, duplicateCoins: 8 },
  { id: "onion-seed", name: "洋葱种子", habitat: "garden", kind: "resident", rarity: "rare", price: 18, duplicateCoins: 9 },
  { id: "chick", name: "小鸡", habitat: "animals", kind: "resident", rarity: "common", price: 7, duplicateCoins: 3 },
  { id: "rabbit", name: "垂耳兔", habitat: "animals", kind: "resident", rarity: "common", price: 10, duplicateCoins: 5 },
  { id: "alpaca", name: "羊驼", habitat: "animals", kind: "resident", rarity: "rare", price: 20, duplicateCoins: 10 },
  { id: "fish-feed", name: "鱼食", habitat: "aquarium", kind: "supply", rarity: "common", price: 2, duplicateCoins: 0, supplyKey: "fishFeed" },
  { id: "fertilizer", name: "肥料", habitat: "garden", kind: "supply", rarity: "common", price: 2, duplicateCoins: 0, supplyKey: "fertilizer" },
  { id: "animal-feed", name: "动物饲料", habitat: "animals", kind: "supply", rarity: "common", price: 2, duplicateCoins: 0, supplyKey: "animalFeed" },
];

export const ECOSYSTEM_ITEM_BY_ID: Readonly<Record<string, EcosystemItemDefinition>> =
  Object.fromEntries(ECOSYSTEM_ITEMS.map((item) => [item.id, item]));

export const ECOSYSTEM_RESIDENTS = ECOSYSTEM_ITEMS.filter((item) => item.kind === "resident");
export const ECOSYSTEM_SUPPLIES = ECOSYSTEM_ITEMS.filter((item) => item.kind === "supply");
