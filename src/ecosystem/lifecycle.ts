import type {
  EcosystemFishLife,
  EcosystemLifecycleState,
  EcosystemLivestockLife,
  EcosystemPlotId,
  EcosystemPlotLife,
  EcosystemState,
  HabitatId,
} from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID, ECOSYSTEM_RESIDENTS } from "./catalog";

const HOUR_MS = 60 * 60 * 1_000;
const MAX_OFFLINE_MS = 7 * 24 * HOUR_MS;
const BOOST_DURATION_MS = 6 * HOUR_MS;
const HARMONY_PER_EVENT = 25;
const MAX_READY_PRODUCTS = 9;
const EPSILON = 1e-9;

/** Each breeding species has a compact pasture enclosure with this hard capacity. */
export const MAX_LIVESTOCK_PER_SPECIES = 12;

const FISH_GROWTH_PER_HOUR = 4;
const CROP_GROWTH_PER_HOUR = 5;
const JUVENILE_GROWTH_PER_HOUR = 3;

const PLOT_IDS: readonly EcosystemPlotId[] = ["1", "2", "3", "4", "5", "6"];
const SEED_IDS = [
  "carrot-seed",
  "tomato-seed",
  "cabbage-seed",
  "leafy-seed",
  "star-pumpkin",
  "onion-seed",
] as const;

export const SEED_PLOT_BY_ID: Readonly<Record<string, EcosystemPlotId>> = Object.freeze(
  Object.fromEntries(SEED_IDS.map((seedId, index) => [seedId, PLOT_IDS[index]])),
);

interface ProductDefinition {
  id: string;
  name: string;
  coins: number;
  productionPerHour?: number;
  becomesJuvenile?: boolean;
}

const CROP_PRODUCTS: Readonly<Record<string, ProductDefinition>> = {
  "carrot-seed": { id: "carrot", name: "胡萝卜", coins: 3 },
  "tomato-seed": { id: "tomato", name: "番茄", coins: 4 },
  "cabbage-seed": { id: "cabbage", name: "卷心菜", coins: 5 },
  "leafy-seed": { id: "leafy-greens", name: "青菜", coins: 6 },
  "star-pumpkin": { id: "star-pumpkin-produce", name: "星光南瓜", coins: 8 },
  "onion-seed": { id: "onion", name: "洋葱", coins: 9 },
};

const LIVESTOCK_PRODUCTS: Readonly<Record<string, ProductDefinition>> = {
  chick: { id: "egg", name: "鸡蛋", coins: 3, productionPerHour: 5 },
  rabbit: {
    id: "rabbit-kit",
    name: "兔宝宝",
    coins: 0,
    productionPerHour: 2.5,
    becomesJuvenile: true,
  },
  alpaca: {
    id: "alpaca-cria",
    name: "羊驼幼崽",
    coins: 0,
    productionPerHour: 2,
    becomesJuvenile: true,
  },
};

export type HabitatLifecycleStage = "growing" | "adult" | "juvenile" | "producing" | "ready";

export interface HabitatLifecycleView {
  habitat: HabitatId;
  id: string;
  name: string;
  stage: HabitatLifecycleStage;
  progress: number;
  readyCount: number;
  productId: string | null;
  productName: string | null;
  inventoryCount: number;
  remainingSecondsAtNormalSpeed: number | null;
  boostedUntil: string | null;
  count: number;
  adults: number;
  juveniles: number;
  generation: number;
  plotId: EcosystemPlotId | null;
}

export interface CollectedHabitatProduce {
  id: string;
  name: string;
  count: number;
  coins: number;
}

/** Returns every currently ready output in a habitat without mutating it. */
export function getHabitatReadyProduce(
  current: EcosystemState,
  habitat: Exclude<HabitatId, "aquarium">,
): CollectedHabitatProduce[] {
  const ecosystem = reconcileEcosystemLifecycle(current);
  const ready: CollectedHabitatProduce[] = [];
  if (habitat === "garden") {
    for (const plot of Object.values(ecosystem.lifecycle.plots)) {
      if (plot.seedId === null || plot.readyYield <= 0) continue;
      const product = CROP_PRODUCTS[plot.seedId];
      if (product === undefined) continue;
      ready.push({
        id: product.id,
        name: product.name,
        count: plot.readyYield,
        coins: plot.readyYield * product.coins,
      });
    }
    return ready;
  }

  for (const [id, livestock] of Object.entries(ecosystem.lifecycle.livestock)) {
    if (livestock.readyProducts <= 0) continue;
    const product = LIVESTOCK_PRODUCTS[id];
    if (product === undefined) continue;
    ready.push({
      id: product.id,
      name: product.name,
      count: livestock.readyProducts,
      coins: livestock.readyProducts * product.coins,
    });
  }
  return ready;
}

/** Adds lifecycle records for every discovered resident without advancing time. */
export function reconcileEcosystemLifecycle(current: EcosystemState): EcosystemState {
  const next = cloneEcosystem(current);

  for (const item of ECOSYSTEM_RESIDENTS) {
    if (!next.discovered.includes(item.id)) continue;
    if (item.habitat === "aquarium" && next.lifecycle.fish[item.id] === undefined) {
      next.lifecycle.fish[item.id] = { count: 1, growth: 0, boostedUntil: null };
    }
    if (item.habitat === "animals" && next.lifecycle.livestock[item.id] === undefined) {
      next.lifecycle.livestock[item.id] = createLivestockLife();
    }
  }

  // Older saves represented newborn rabbits and alpacas as products waiting to
  // be collected. They are living animals, so fold them into the single
  // juvenile cohort immediately. Capacity is enforced before migration so an
  // already-corrupt save cannot recreate an unbounded population.
  for (const [id, livestock] of Object.entries(next.lifecycle.livestock)) {
    const product = LIVESTOCK_PRODUCTS[id];
    if (product?.becomesJuvenile !== true) continue;
    normalizeBreedingPopulation(livestock);
    if (livestock.readyProducts <= 0) continue;
    const newborns = mergeNewbornsIntoCohort(livestock, livestock.readyProducts);
    livestock.readyProducts = 0;
    livestock.generation += newborns;
  }

  for (const seedId of SEED_IDS) {
    const plotId = SEED_PLOT_BY_ID[seedId];
    const plot = next.lifecycle.plots[plotId];
    if (next.discovered.includes(seedId) && plot.seedId !== seedId) {
      next.lifecycle.plots[plotId] = createPlotLife(seedId, plot.generation > 0 ? plot.generation : 1);
    }
  }

  syncLegacyProgress(next);
  return next;
}

/** Advances all habitats to a wall-clock time, with a maximum of seven days per catch-up. */
export function advanceEcosystemTo(current: EcosystemState, now: Date): EcosystemState {
  const next = reconcileEcosystemLifecycle(current);
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return next;

  const lastIso = next.lifecycle.lastSimulatedAt;
  if (lastIso === null) {
    next.lifecycle.lastSimulatedAt = now.toISOString();
    syncLegacyProgress(next);
    return next;
  }

  const lastMs = Date.parse(lastIso);
  if (!Number.isFinite(lastMs)) {
    next.lifecycle.lastSimulatedAt = now.toISOString();
    syncLegacyProgress(next);
    return next;
  }
  if (nowMs <= lastMs) return next;

  const simulatedUntilMs = Math.min(nowMs, lastMs + MAX_OFFLINE_MS);

  for (const fish of Object.values(next.lifecycle.fish)) {
    const effectiveHours = effectiveHoursBetween(lastMs, simulatedUntilMs, fish.boostedUntil);
    const before = fish.growth;
    if (fish.count > 0 && before < 100) {
      fish.growth = clampProgress(before + effectiveHours * FISH_GROWTH_PER_HOUR);
      if (before < 100 && fish.growth === 100) registerEvents(next, "aquarium", 1);
    }
    fish.boostedUntil = activeBoostAfter(fish.boostedUntil, simulatedUntilMs);
  }

  for (const plot of Object.values(next.lifecycle.plots)) {
    const effectiveHours = effectiveHoursBetween(lastMs, simulatedUntilMs, plot.boostedUntil);
    if (plot.seedId !== null && plot.readyYield === 0 && plot.growth < 100) {
      plot.growth = clampProgress(plot.growth + effectiveHours * CROP_GROWTH_PER_HOUR);
      if (plot.growth === 100) {
        plot.readyYield = 1;
        registerEvents(next, "garden", 1);
      }
    }
    plot.boostedUntil = activeBoostAfter(plot.boostedUntil, simulatedUntilMs);
  }

  for (const [id, livestock] of Object.entries(next.lifecycle.livestock)) {
    const effectiveHours = effectiveHoursBetween(lastMs, simulatedUntilMs, livestock.boostedUntil);
    advanceLivestock(next, id, livestock, effectiveHours);
    livestock.boostedUntil = activeBoostAfter(livestock.boostedUntil, simulatedUntilMs);
  }

  // Excess offline time is deliberately discarded after the bounded catch-up.
  next.lifecycle.lastSimulatedAt = now.toISOString();
  syncLegacyProgress(next);
  return next;
}

/** Applies deterministic task-completion growth without moving the wall-clock anchor. */
export function advanceEcosystemByWork(
  current: EcosystemState,
  workUnits = 1,
): EcosystemState {
  const next = reconcileEcosystemLifecycle(current);
  if (!Number.isSafeInteger(workUnits) || workUnits <= 0) return next;

  for (const fish of Object.values(next.lifecycle.fish)) {
    const before = fish.growth;
    if (fish.count > 0 && before < 100) {
      fish.growth = clampProgress(before + workUnits * FISH_GROWTH_PER_HOUR);
      if (before < 100 && fish.growth === 100) registerEvents(next, "aquarium", 1);
    }
  }

  for (const plot of Object.values(next.lifecycle.plots)) {
    if (plot.seedId === null || plot.readyYield > 0 || plot.growth >= 100) continue;
    plot.growth = clampProgress(plot.growth + workUnits * CROP_GROWTH_PER_HOUR);
    if (plot.growth === 100) {
      plot.readyYield = 1;
      registerEvents(next, "garden", 1);
    }
  }

  for (const [id, livestock] of Object.entries(next.lifecycle.livestock)) {
    advanceLivestock(next, id, livestock, workUnits);
  }

  syncLegacyProgress(next);
  return next;
}

/** Applies six hours of double-speed care to the currently selected resident or plot. */
export function boostHabitatLifecycle(
  current: EcosystemState,
  habitat: HabitatId,
  now: Date,
): EcosystemState {
  const next = advanceEcosystemTo(current, now);
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return next;
  const lastMs = next.lifecycle.lastSimulatedAt === null
    ? nowMs
    : Math.max(nowMs, Date.parse(next.lifecycle.lastSimulatedAt));
  const boostedUntil = new Date(lastMs + BOOST_DURATION_MS).toISOString();

  if (habitat === "aquarium") {
    const fish = next.lifecycle.fish[next.selected.aquarium];
    if (fish !== undefined) fish.boostedUntil = laterIso(fish.boostedUntil, boostedUntil);
  } else if (habitat === "garden") {
    const plotId = SEED_PLOT_BY_ID[next.selected.garden];
    const plot = plotId === undefined ? undefined : next.lifecycle.plots[plotId];
    if (plot !== undefined) plot.boostedUntil = laterIso(plot.boostedUntil, boostedUntil);
  } else {
    const livestock = next.lifecycle.livestock[next.selected.animals];
    if (livestock !== undefined) livestock.boostedUntil = laterIso(livestock.boostedUntil, boostedUntil);
  }

  return next;
}

/** Collects all ready produce in a habitat. Wallet credit is returned, never applied here. */
export function collectHabitatProduce(
  current: EcosystemState,
  habitat: Exclude<HabitatId, "aquarium">,
  now: Date,
): {
  ecosystem: EcosystemState;
  collected: CollectedHabitatProduce[];
  totalCoins: number;
} {
  const ecosystem = advanceEcosystemTo(current, now);
  const collected: CollectedHabitatProduce[] = [];

  if (habitat === "garden") {
    for (const plot of Object.values(ecosystem.lifecycle.plots)) {
      if (plot.seedId === null || plot.readyYield <= 0) continue;
      const product = CROP_PRODUCTS[plot.seedId];
      if (product === undefined) continue;
      const count = plot.readyYield;
      addProduce(ecosystem.lifecycle, product.id, count);
      collected.push({
        id: product.id,
        name: product.name,
        count,
        coins: count * product.coins,
      });
      plot.growth = 0;
      plot.readyYield = 0;
      plot.generation += 1;
    }
  } else {
    for (const [id, livestock] of Object.entries(ecosystem.lifecycle.livestock)) {
      if (livestock.readyProducts <= 0) continue;
      const product = LIVESTOCK_PRODUCTS[id];
      if (product === undefined) continue;
      const count = livestock.readyProducts;
      collected.push({
        id: product.id,
        name: product.name,
        count,
        coins: count * product.coins,
      });
      if (product.becomesJuvenile === true) {
        livestock.juveniles += count;
        livestock.juvenileGrowth = 0;
        livestock.generation += 1;
      } else {
        addProduce(ecosystem.lifecycle, product.id, count);
      }
      livestock.readyProducts = 0;
    }
  }

  syncLegacyProgress(ecosystem);
  return {
    ecosystem,
    collected,
    totalCoins: collected.reduce((sum, item) => sum + item.coins, 0),
  };
}

/** A compact, deterministic projection for the currently selected habitat resident. */
export function getHabitatLifecycleView(
  current: EcosystemState,
  habitat: HabitatId,
): HabitatLifecycleView {
  const ecosystem = reconcileEcosystemLifecycle(current);
  const id = ecosystem.selected[habitat];
  const item = ECOSYSTEM_ITEM_BY_ID[id];
  const name = item?.name ?? id;

  if (habitat === "aquarium") {
    const fish = ecosystem.lifecycle.fish[id] ?? { count: 0, growth: 0, boostedUntil: null };
    return {
      habitat,
      id,
      name,
      stage: fish.growth >= 100 ? "adult" : "growing",
      progress: fish.growth,
      readyCount: 0,
      productId: null,
      productName: null,
      inventoryCount: 0,
      remainingSecondsAtNormalSpeed: fish.growth >= 100
        ? null
        : secondsForProgress(fish.growth, FISH_GROWTH_PER_HOUR),
      boostedUntil: fish.boostedUntil,
      count: fish.count,
      adults: fish.growth >= 100 ? fish.count : 0,
      juveniles: fish.growth >= 100 ? 0 : fish.count,
      generation: 1,
      plotId: null,
    };
  }

  if (habitat === "garden") {
    const plotId = SEED_PLOT_BY_ID[id] ?? null;
    const plot = plotId === null ? createPlotLife(null, 0) : ecosystem.lifecycle.plots[plotId];
    const product = CROP_PRODUCTS[id];
    const ready = plot.readyYield > 0;
    return {
      habitat,
      id,
      name,
      stage: ready ? "ready" : "growing",
      progress: ready ? 100 : plot.growth,
      readyCount: plot.readyYield,
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      inventoryCount: product === undefined ? 0 : (ecosystem.lifecycle.produce[product.id] ?? 0),
      remainingSecondsAtNormalSpeed: ready
        ? 0
        : secondsForProgress(plot.growth, CROP_GROWTH_PER_HOUR),
      boostedUntil: plot.boostedUntil,
      count: plot.seedId === null ? 0 : 1,
      adults: 0,
      juveniles: 0,
      generation: plot.generation,
      plotId,
    };
  }

  const livestock = ecosystem.lifecycle.livestock[id] ?? createLivestockLife();
  const product = LIVESTOCK_PRODUCTS[id];
  const isReady = livestock.readyProducts > 0;
  const hasJuveniles = livestock.juveniles > 0;
  const stage: HabitatLifecycleStage = isReady
    ? "ready"
    : hasJuveniles
      ? "juvenile"
      : livestock.adults > 0
        ? "producing"
        : "juvenile";
  const progress = isReady ? 100 : hasJuveniles ? livestock.juvenileGrowth : livestock.production;
  const rate = hasJuveniles ? JUVENILE_GROWTH_PER_HOUR : product?.productionPerHour;
  return {
    habitat,
    id,
    name,
    stage,
    progress,
    readyCount: livestock.readyProducts,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    inventoryCount: product?.becomesJuvenile === true || product === undefined
      ? 0
      : (ecosystem.lifecycle.produce[product.id] ?? 0),
    remainingSecondsAtNormalSpeed: isReady
      ? 0
      : rate === undefined
        ? null
        : secondsForProgress(progress, rate),
    boostedUntil: livestock.boostedUntil,
    count: livestock.adults + livestock.juveniles,
    adults: livestock.adults,
    juveniles: livestock.juveniles,
    generation: livestock.generation,
    plotId: null,
  };
}

function advanceLivestock(
  ecosystem: EcosystemState,
  id: string,
  livestock: EcosystemLivestockLife,
  effectiveHours: number,
): void {
  if (!Number.isFinite(effectiveHours) || effectiveHours <= 0) return;

  const product = LIVESTOCK_PRODUCTS[id];
  if (product?.becomesJuvenile === true) {
    advanceBreedingLivestock(ecosystem, livestock, product.productionPerHour!, effectiveHours);
    return;
  }
  let remainingHours = effectiveHours;

  // Maturation and ordinary produce generation run on the same clock, so a
  // newly matured non-breeding animal can use the remaining elapsed time.
  while (remainingHours > EPSILON) {
    if (livestock.juveniles > 0 && livestock.juvenileGrowth >= 100 - EPSILON) {
      matureJuvenileCohort(ecosystem, livestock);
      continue;
    }

    const canProduce = livestock.adults > 0
      && product?.productionPerHour !== undefined
      && livestock.readyProducts < MAX_READY_PRODUCTS;
    const productionRate = canProduce
      ? product.productionPerHour! * livestock.adults
      : 0;
    const hoursToMaturity = livestock.juveniles > 0
      ? Math.max(0, (100 - livestock.juvenileGrowth) / JUVENILE_GROWTH_PER_HOUR)
      : Number.POSITIVE_INFINITY;
    const hoursToProduct = productionRate > 0
      ? Math.max(0, (100 - livestock.production) / productionRate)
      : Number.POSITIVE_INFINITY;
    const elapsed = Math.min(remainingHours, hoursToMaturity, hoursToProduct);

    if (!Number.isFinite(elapsed)) break;
    if (elapsed > EPSILON) {
      if (livestock.juveniles > 0) {
        livestock.juvenileGrowth = clampProgress(
          livestock.juvenileGrowth + elapsed * JUVENILE_GROWTH_PER_HOUR,
        );
      }
      if (productionRate > 0) {
        livestock.production = cleanProgress(livestock.production + elapsed * productionRate);
      }
      remainingHours = Math.max(0, remainingHours - elapsed);
    }

    let handledEvent = false;
    // When birth and maturity share a timestamp, mature the older cohort first;
    // otherwise a newborn would incorrectly hold fully grown animals back.
    if (livestock.juveniles > 0 && livestock.juvenileGrowth >= 100 - EPSILON) {
      matureJuvenileCohort(ecosystem, livestock);
      handledEvent = true;
    }

    if (productionRate > 0 && livestock.production >= 100 - EPSILON) {
      livestock.production = cleanProgress(Math.max(0, livestock.production - 100));
      livestock.readyProducts += 1;
      registerEvents(ecosystem, "animals", 1);
      handledEvent = true;
    }

    if (!handledEvent) break;
  }
}

/**
 * Advances one breeding species without allowing animals born in this call to
 * consume the remaining elapsed time. Existing juveniles may mature once, and
 * their adult production starts only after that maturity point.
 */
function advanceBreedingLivestock(
  ecosystem: EcosystemState,
  livestock: EcosystemLivestockLife,
  productionPerHour: number,
  effectiveHours: number,
): void {
  normalizeBreedingPopulation(livestock);
  const populationBefore = livestock.adults + livestock.juveniles;
  const availableSpace = Math.max(0, MAX_LIVESTOCK_PER_SPECIES - populationBefore);
  const adultsAtStart = livestock.adults;
  const juvenilesAtStart = livestock.juveniles;
  let hoursAfterMaturity = 0;

  if (juvenilesAtStart > 0) {
    const hoursToMaturity = Math.max(
      0,
      (100 - livestock.juvenileGrowth) / JUVENILE_GROWTH_PER_HOUR,
    );
    if (hoursToMaturity <= effectiveHours + EPSILON) {
      hoursAfterMaturity = Math.max(0, effectiveHours - hoursToMaturity);
      matureJuvenileCohort(ecosystem, livestock);
    } else {
      livestock.juvenileGrowth = clampProgress(
        livestock.juvenileGrowth + effectiveHours * JUVENILE_GROWTH_PER_HOUR,
      );
    }
  }

  if (availableSpace <= 0 || productionPerHour <= 0) return;
  const adultHours = adultsAtStart * effectiveHours + juvenilesAtStart * hoursAfterMaturity;
  const accumulatedProduction = cleanProgress(
    livestock.production + adultHours * productionPerHour,
  );
  const possibleBirths = Math.max(0, Math.floor((accumulatedProduction + EPSILON) / 100));
  const newborns = Math.min(availableSpace, possibleBirths);
  livestock.production = cleanProgress(accumulatedProduction - possibleBirths * 100);
  if (newborns <= 0) return;

  const acceptedNewborns = mergeNewbornsIntoCohort(livestock, newborns);
  livestock.generation += acceptedNewborns;
  registerEvents(ecosystem, "animals", acceptedNewborns);
}

function matureJuvenileCohort(
  ecosystem: EcosystemState,
  livestock: EcosystemLivestockLife,
): void {
  const matured = livestock.juveniles;
  if (matured <= 0) return;
  livestock.adults += matured;
  livestock.juveniles = 0;
  livestock.juvenileGrowth = 0;
  registerEvents(ecosystem, "animals", matured);
}

function mergeNewbornsIntoCohort(
  livestock: EcosystemLivestockLife,
  newborns: number,
): number {
  if (!Number.isSafeInteger(newborns) || newborns <= 0) return 0;
  const acceptedNewborns = Math.min(
    newborns,
    Math.max(0, MAX_LIVESTOCK_PER_SPECIES - livestock.adults - livestock.juveniles),
  );
  if (acceptedNewborns <= 0) return 0;
  const existingJuveniles = livestock.juveniles;
  const combinedJuveniles = existingJuveniles + acceptedNewborns;
  const storedGrowth = existingJuveniles * livestock.juvenileGrowth;
  livestock.juveniles = combinedJuveniles;
  livestock.juvenileGrowth = cleanProgress(storedGrowth / combinedJuveniles);
  return acceptedNewborns;
}

function normalizeBreedingPopulation(livestock: EcosystemLivestockLife): void {
  livestock.adults = Math.min(MAX_LIVESTOCK_PER_SPECIES, Math.max(0, livestock.adults));
  const juvenileCapacity = MAX_LIVESTOCK_PER_SPECIES - livestock.adults;
  livestock.juveniles = Math.min(juvenileCapacity, Math.max(0, livestock.juveniles));
  if (livestock.juveniles === 0) livestock.juvenileGrowth = 0;
}

function effectiveHoursBetween(startMs: number, endMs: number, boostedUntil: string | null): number {
  const elapsedMs = Math.max(0, endMs - startMs);
  if (boostedUntil === null) return elapsedMs / HOUR_MS;
  const boostEndMs = Date.parse(boostedUntil);
  if (!Number.isFinite(boostEndMs)) return elapsedMs / HOUR_MS;
  const overlapMs = Math.max(0, Math.min(endMs, boostEndMs) - startMs);
  return (elapsedMs + overlapMs) / HOUR_MS;
}

function activeBoostAfter(boostedUntil: string | null, simulatedUntilMs: number): string | null {
  if (boostedUntil === null) return null;
  const boostEndMs = Date.parse(boostedUntil);
  return Number.isFinite(boostEndMs) && boostEndMs > simulatedUntilMs ? boostedUntil : null;
}

function laterIso(current: string | null, candidate: string): string {
  if (current === null) return candidate;
  return Date.parse(current) > Date.parse(candidate) ? current : candidate;
}

function registerEvents(ecosystem: EcosystemState, habitat: HabitatId, count: number): void {
  if (count <= 0) return;
  ecosystem.milestones[habitat] += count;
  ecosystem.harmony = Math.min(100, ecosystem.harmony + count * HARMONY_PER_EVENT);
}

function syncLegacyProgress(ecosystem: EcosystemState): void {
  const fish = ecosystem.lifecycle.fish[ecosystem.selected.aquarium];
  ecosystem.progress.aquarium = Math.round(fish?.growth ?? 0);

  const plotId = SEED_PLOT_BY_ID[ecosystem.selected.garden];
  const plot = plotId === undefined ? undefined : ecosystem.lifecycle.plots[plotId];
  ecosystem.progress.garden = Math.round(plot === undefined
    ? 0
    : plot.readyYield > 0
      ? 100
      : plot.growth);

  const livestock = ecosystem.lifecycle.livestock[ecosystem.selected.animals];
  ecosystem.progress.animals = Math.round(livestock === undefined
    ? 0
    : livestock.juveniles > 0
      ? livestock.juvenileGrowth
      : livestock.production);
}

function addProduce(lifecycle: EcosystemLifecycleState, id: string, count: number): void {
  lifecycle.produce[id] = (lifecycle.produce[id] ?? 0) + count;
}

function secondsForProgress(progress: number, ratePerHour: number): number {
  return Math.max(0, Math.ceil(((100 - progress) / ratePerHour) * 3_600));
}

function clampProgress(value: number): number {
  return cleanProgress(Math.min(100, Math.max(0, value)));
}

function cleanProgress(value: number): number {
  return Math.abs(value) < EPSILON ? 0 : value;
}

function createPlotLife(seedId: string | null, generation: number): EcosystemPlotLife {
  return { seedId, growth: 0, readyYield: 0, boostedUntil: null, generation };
}

function createLivestockLife(): EcosystemLivestockLife {
  return {
    adults: 0,
    juveniles: 1,
    juvenileGrowth: 0,
    production: 0,
    readyProducts: 0,
    boostedUntil: null,
    generation: 1,
  };
}

function cloneEcosystem(current: EcosystemState): EcosystemState {
  return {
    discovered: [...current.discovered],
    selected: { ...current.selected },
    supplies: { ...current.supplies },
    progress: { ...current.progress },
    milestones: { ...current.milestones },
    harmony: current.harmony,
    lifecycle: cloneLifecycle(current.lifecycle),
  };
}

function cloneLifecycle(current: EcosystemLifecycleState): EcosystemLifecycleState {
  const fish: Record<string, EcosystemFishLife> = {};
  for (const [id, life] of Object.entries(current.fish)) fish[id] = { ...life };
  const livestock: Record<string, EcosystemLivestockLife> = {};
  for (const [id, life] of Object.entries(current.livestock)) livestock[id] = { ...life };
  const plots = Object.fromEntries(
    PLOT_IDS.map((plotId) => [plotId, { ...current.plots[plotId] }]),
  ) as Record<EcosystemPlotId, EcosystemPlotLife>;
  return {
    lastSimulatedAt: current.lastSimulatedAt,
    fish,
    plots,
    livestock,
    produce: { ...current.produce },
  };
}
