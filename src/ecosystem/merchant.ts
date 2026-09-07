import { z } from "zod";
import type { EcosystemState, GameState, HabitatId, MerchantLedger } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID, ECOSYSTEM_RESIDENTS, ECOSYSTEM_SUPPLIES, type EcosystemItemDefinition } from "./catalog";
import { isEcosystemItemLockedByActiveSpin } from "./ecosystem";
import { recordJournalHarvest } from "./journal";
import { collectHabitatProduce, getHabitatReadyProduce, reconcileEcosystemLifecycle, type CollectedHabitatProduce } from "./lifecycle";
import { worldDate, worldView } from "./world-clock";

const COMMON_RESIDENTS = ECOSYSTEM_RESIDENTS.filter(item => item.rarity === "common");
const MERCHANT_ITEMS = [...ECOSYSTEM_SUPPLIES, ...COMMON_RESIDENTS];
const VALID_ITEM_IDS = new Set(MERCHANT_ITEMS.map(item => item.id));
const MAX_SUPPLY = 999;
const SELL_LIMIT = 24;
const OPEN_MINUTE = 8 * 60;
const CLOSE_MINUTE = 20 * 60;

export const merchantStateSchema: z.ZodType<MerchantLedger> = z.object({
  visitId: z.string().regex(/^merchant-[0-9a-f]{1,8}-[1-9]\d{0,8}$/),
  purchased: z.record(z.string().min(1).max(64), z.number().int().min(0).max(2)).refine(values =>
    Object.keys(values).length <= 5 && Object.entries(values).every(([id, count]) =>
      VALID_ITEM_IDS.has(id) && (ECOSYSTEM_ITEM_BY_ID[id].kind === "supply" || count <= 1))),
  soldCount: z.number().int().min(0).max(SELL_LIMIT),
}).strict();

export interface MerchantOffer {
  itemId: string;
  name: string;
  kind: "supply" | "resident";
  habitat: HabitatId;
  /** Authoritative total price and units delivered by one purchase. */
  price: number;
  quantity: number;
  limit: number;
  remaining: number;
  owned: boolean;
}

export interface MerchantView {
  present: boolean;
  visitId: string | null;
  arrivalDay: number;
  nextArrivalDay: number;
  departure: { day: number; hour: 20; minute: 0 };
  offers: MerchantOffer[];
  soldCount: number;
  sellLimit: number;
}

export type MerchantError = "merchant-away" | "stale-visit" | "unknown-item" | "out-of-stock"
  | "already-owned" | "insufficient-coins" | "locked-spin-reward" | "inventory-full"
  | "trade-limit" | "nothing-to-harvest" | "invalid-state" | "invalid-habitat";

export type MerchantTradeResult =
  | { ok: true; state: GameState; totalCoins: number; quantity: number; collected?: CollectedHabitatProduce[] }
  | { ok: false; reason: MerchantError };

export interface MerchantSaleQuote {
  habitat: "garden" | "animals";
  quantity: number;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  collected: CollectedHabitatProduce[];
  remainingQuota: number;
  withinLimit: boolean;
}

/** One visit in days 2–4, one in days 5–7, etc. Reads never reroll or refill stock. */
export function getMerchantView(ecosystem: EcosystemState): MerchantView {
  const time = worldView(ecosystem.world);
  const seed = (ecosystem.world?.seed ?? 0) >>> 0;
  let window = Math.max(0, Math.floor((time.day - 2) / 3));
  let arrivalDay = arrivalForWindow(seed, window);
  // Once a visit has ended, the board previews the next actual visit as a unit:
  // date, identity, goods and fresh stock must never mix two different windows.
  if (time.day > arrivalDay || (time.day === arrivalDay && time.minuteOfDay >= CLOSE_MINUTE)) {
    window++;
    arrivalDay = arrivalForWindow(seed, window);
  }
  const visitId = `merchant-${seed.toString(16)}-${arrivalDay}`;
  const present = time.day === arrivalDay && time.minuteOfDay >= OPEN_MINUTE && time.minuteOfDay < CLOSE_MINUTE;
  const nextArrivalDay = present ? arrivalForWindow(seed, window + 1) : arrivalDay;
  const ledger = ledgerForVisit(ecosystem, visitId);
  // Sorting a fixed catalog by seeded hashes gives two distinct entries without mutable RNG state.
  const rotating = [...COMMON_RESIDENTS].sort((left, right) =>
    stableHash(`${seed}:${window}:stock:${left.id}`) - stableHash(`${seed}:${window}:stock:${right.id}`) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)).slice(0, 2);
  const offers = [...ECOSYSTEM_SUPPLIES, ...rotating].map(item => offerFor(item, ecosystem, ledger));
  return { present, visitId, arrivalDay, nextArrivalDay, departure: { day: arrivalDay, hour: 20, minute: 0 },
    offers, soldCount: boundedCount(ledger.soldCount, SELL_LIMIT), sellLimit: SELL_LIMIT };
}

/** No price or quantity argument is accepted from the client. A partially fitting bundle is refused. */
export function buyFromMerchant(game: GameState, itemId: string, visitId: string): MerchantTradeResult {
  const view = getMerchantView(game.ecosystem);
  const preflight = tradePreflight(game, view, visitId);
  if (preflight) return { ok: false, reason: preflight };
  const offer = view.offers.find(item => item.itemId === itemId);
  if (!offer) return { ok: false, reason: "unknown-item" };
  if (offer.owned) return { ok: false, reason: "already-owned" };
  if (isEcosystemItemLockedByActiveSpin(game, itemId)) return { ok: false, reason: "locked-spin-reward" };
  if (offer.remaining === 0) return { ok: false, reason: "out-of-stock" };
  if (game.wallet < offer.price) return { ok: false, reason: "insufficient-coins" };
  const item = ECOSYSTEM_ITEM_BY_ID[itemId];
  if (item.kind === "supply" && game.ecosystem.supplies[item.supplyKey!] + offer.quantity > MAX_SUPPLY) {
    return { ok: false, reason: "inventory-full" };
  }

  let ecosystem = structuredClone(game.ecosystem);
  if (item.kind === "supply") ecosystem.supplies[item.supplyKey!] += offer.quantity;
  else {
    ecosystem.discovered.push(itemId);
    ecosystem.selected[item.habitat] = itemId;
    ecosystem = reconcileEcosystemLifecycle(ecosystem);
  }
  const merchant = ledgerForVisit(game.ecosystem, visitId);
  merchant.purchased[itemId] = (merchant.purchased[itemId] ?? 0) + 1;
  ecosystem.merchant = merchant;
  return { ok: true, state: { ...game, wallet: game.wallet - offer.price, ecosystem }, totalCoins: offer.price, quantity: offer.quantity };
}

/** Quotes fresh output only. lifecycle.produce is already-paid history, never sellable inventory. */
export function getMerchantSaleQuote(ecosystem: EcosystemState, habitat: "garden" | "animals"): MerchantSaleQuote {
  const view = getMerchantView(ecosystem);
  const ready = habitat === "garden" || habitat === "animals"
    ? getHabitatReadyProduce(ecosystem, habitat).filter(item => habitat === "garden" || item.id === "egg") : [];
  const quantity = ready.reduce((sum, item) => sum + item.count, 0);
  const baseCoins = ready.reduce((sum, item) => sum + item.coins, 0);
  const bonusCoins = quantity;
  const totalCoins = baseCoins + bonusCoins;
  const remainingQuota = SELL_LIMIT - view.soldCount;
  const valid = ready.every(item => safeCount(item.count) && item.count > 0 && safeCount(item.coins))
    && safeCount(quantity) && safeCount(totalCoins);
  return { habitat, quantity, baseCoins, bonusCoins, totalCoins,
    collected: ready.map(item => ({ ...item, coins: item.coins + item.count })), remainingQuota,
    withinLimit: valid && quantity > 0 && quantity <= remainingQuota };
}

/** Sell all currently mature plants or eggs as one atomic batch; live animals are never traded. */
export function sellToMerchant(game: GameState, habitat: "garden" | "animals", visitId: string): MerchantTradeResult {
  if (habitat !== "garden" && habitat !== "animals") return { ok: false, reason: "invalid-habitat" };
  const view = getMerchantView(game.ecosystem);
  const preflight = tradePreflight(game, view, visitId);
  if (preflight) return { ok: false, reason: preflight };
  const quote = getMerchantSaleQuote(game.ecosystem, habitat);
  if (!safeCount(quote.quantity) || !safeCount(quote.totalCoins) || !safeCount(game.wallet + quote.totalCoins)) {
    return { ok: false, reason: "invalid-state" };
  }
  if (quote.quantity === 0) return { ok: false, reason: "nothing-to-harvest" };
  if (!quote.withinLimit) return { ok: false, reason: "trade-limit" };
  const now = worldDate(game.ecosystem.world);
  // Host synchronization already advanced the world. Freeze this private collector copy
  // at the current instant so quoting and collecting cannot grow another crop mid-trade.
  const frozen = { ...game.ecosystem, lifecycle: { ...game.ecosystem.lifecycle, lastSimulatedAt: now.toISOString() } };
  const harvested = collectHabitatProduce(frozen, habitat, now);
  const ecosystem = structuredClone(game.ecosystem);
  const produce = { ...ecosystem.lifecycle.produce };
  for (const output of quote.collected) {
    const count = (produce[output.id] ?? 0) + output.count;
    if (!safeCount(count)) return { ok: false, reason: "invalid-state" };
    produce[output.id] = count;
  }
  if (habitat === "garden") {
    for (const [id, plot] of Object.entries(ecosystem.lifecycle.plots)) {
      if (plot.seedId === null || plot.readyYield <= 0) continue;
      const seed = Object.hasOwn(ECOSYSTEM_ITEM_BY_ID, plot.seedId) ? ECOSYSTEM_ITEM_BY_ID[plot.seedId] : undefined;
      if (!seed || seed.kind !== "resident" || seed.habitat !== "garden") continue;
      if (plot.nextSeedId !== undefined) {
        const nextSeed = Object.hasOwn(ECOSYSTEM_ITEM_BY_ID, plot.nextSeedId) ? ECOSYSTEM_ITEM_BY_ID[plot.nextSeedId] : undefined;
        if (!nextSeed || nextSeed.kind !== "resident" || nextSeed.habitat !== "garden" || !ecosystem.discovered.includes(plot.nextSeedId)) {
          return { ok: false, reason: "invalid-state" };
        }
      }
      const plotId = id as keyof typeof ecosystem.lifecycle.plots;
      const nextPlot = harvested.ecosystem.lifecycle.plots[plotId];
      if (!safeCount(nextPlot.generation)) return { ok: false, reason: "invalid-state" };
      ecosystem.lifecycle.plots[plotId] = { ...nextPlot };
    }
    ecosystem.selected.garden = harvested.ecosystem.selected.garden;
    ecosystem.progress.garden = harvested.ecosystem.progress.garden;
  } else if (ecosystem.lifecycle.livestock.chick) {
    // Preserve rabbit/alpaca cohorts byte-for-byte, including legacy newborn records.
    ecosystem.lifecycle.livestock.chick.readyProducts = 0;
  }
  ecosystem.lifecycle.produce = produce;
  const merchant = ledgerForVisit(game.ecosystem, visitId);
  merchant.soldCount += quote.quantity;
  ecosystem.merchant = merchant;
  return { ok: true, state: { ...game, wallet: game.wallet + quote.totalCoins,
    ecosystem: recordJournalHarvest(ecosystem, quote.quantity, now) },
    totalCoins: quote.totalCoins, quantity: quote.quantity, collected: quote.collected };
}

function tradePreflight(game: GameState, view: MerchantView, visitId: string): MerchantError | null {
  if (view.visitId !== visitId) return "stale-visit";
  if (!view.present) return "merchant-away";
  if (!safeCount(game.wallet) || !Object.values(game.ecosystem.supplies).every(count => safeCount(count) && count <= MAX_SUPPLY)) return "invalid-state";
  if (game.ecosystem.merchant !== undefined && !merchantStateSchema.safeParse(game.ecosystem.merchant).success) return "invalid-state";
  const ledger = ledgerForVisit(game.ecosystem, visitId);
  if (Object.keys(ledger.purchased).some(id => !view.offers.some(offer => offer.itemId === id))) return "invalid-state";
  return null;
}

function ledgerForVisit(ecosystem: EcosystemState, visitId: string): MerchantLedger {
  return ecosystem.merchant?.visitId === visitId
    ? { visitId, purchased: { ...ecosystem.merchant.purchased }, soldCount: ecosystem.merchant.soldCount }
    : { visitId, purchased: {}, soldCount: 0 };
}

function offerFor(item: EcosystemItemDefinition, ecosystem: EcosystemState, ledger: MerchantLedger): MerchantOffer {
  const supply = item.kind === "supply";
  const limit = supply ? 2 : 1;
  const purchased = Object.hasOwn(ledger.purchased, item.id) ? ledger.purchased[item.id] : 0;
  return { itemId: item.id, name: item.name, kind: item.kind, habitat: item.habitat,
    price: supply ? item.price * 2 : Math.max(1, item.price - 1), quantity: supply ? 3 : 1,
    limit, remaining: limit - boundedCount(purchased, limit), owned: !supply && ecosystem.discovered.includes(item.id) };
}

function arrivalForWindow(seed: number, window: number): number {
  return 2 + window * 3 + stableHash(`${seed}:${window}:arrival`) % 3;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function safeCount(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function boundedCount(value: number, max: number): number { return safeCount(value) ? Math.min(max, value) : max; }
