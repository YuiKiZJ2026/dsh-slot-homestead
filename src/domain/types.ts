export type DateKey = `${number}-${number}-${number}`;
export type Rarity = "common" | "rare" | "set";
export type ReelSymbol = "coin" | "leaf" | "crystal" | "moon" | "robot";
export type AgentStatus = "idle" | "working" | "completed" | "error";
export type HabitatId = "aquarium" | "garden" | "animals";
export type EcosystemSupplyKey = "fishFeed" | "fertilizer" | "animalFeed";
export type EcosystemPlotId = "1" | "2" | "3" | "4" | "5" | "6";
export type TablePositionId =
  | "left-rear-round"
  | "left-rear-small"
  | "right-rear-small"
  | "right-rear-round"
  | "left-middle-round"
  | "left-middle-small"
  | "right-middle-small"
  | "right-middle-round"
  | "left-front-round"
  | "left-front-small"
  | "center-front"
  | "right-front-round";

export interface TablePlacement {
  itemId: string;
  positionId: TablePositionId;
}

export interface DailyLedger {
  workCoins: number;
  focusMinutes: number;
  settledFocusHours: number;
  focusCoins: number;
}

export type ResolvedReward =
  | { kind: "none" }
  | { kind: "coins"; amount: number; reason: "refund" | "five-coins" | "pity-fallback" | "robot-fallback" }
  | {
      kind: "collectible";
      collectibleId: string;
      isDuplicate: boolean;
      conversionCoins: number;
      bonusCoins: number;
    }
  | {
      kind: "ecosystem-item";
      itemId: string;
      isDuplicate: boolean;
      conversionCoins: number;
    };

export interface ResolvedSpin {
  id: string;
  stage: "coin-inserted" | "spinning" | "highlight" | "payout" | "settled";
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  reward: ResolvedReward;
  pityAfter: number;
  createdAt: string;
}

export interface GameSettings {
  muted: boolean;
  reducedMotion: boolean;
  scale: 1 | 2;
  companionScale?: number;
}

export interface EcosystemState {
  discovered: string[];
  selected: Record<HabitatId, string>;
  supplies: Record<EcosystemSupplyKey, number>;
  progress: Record<HabitatId, number>;
  milestones: Record<HabitatId, number>;
  harmony: number;
  lifecycle: EcosystemLifecycleState;
}

export interface EcosystemFishLife {
  count: number;
  growth: number;
  boostedUntil: string | null;
}

export interface EcosystemPlotLife {
  seedId: string | null;
  growth: number;
  readyYield: number;
  boostedUntil: string | null;
  generation: number;
}

export interface EcosystemLivestockLife {
  adults: number;
  juveniles: number;
  juvenileGrowth: number;
  production: number;
  readyProducts: number;
  boostedUntil: string | null;
  generation: number;
}

export interface EcosystemLifecycleState {
  lastSimulatedAt: string | null;
  fish: Record<string, EcosystemFishLife>;
  plots: Record<EcosystemPlotId, EcosystemPlotLife>;
  livestock: Record<string, EcosystemLivestockLife>;
  produce: Record<string, number>;
}

export interface GameState {
  schemaVersion: 1;
  revision: number;
  wallet: number;
  lastAwardDate: DateKey | null;
  dailyLedgers: Record<string, DailyLedger>;
  processedEvents: Record<string, string>;
  completedTasks: Record<string, string>;
  verifiedTasks: Record<string, string>;
  pendingVerifications: Record<string, { eventId: string; occurredAt: string }>;
  pityMisses: number;
  ownedCollectibles: string[];
  displayedCollectibles: string[];
  tablePlacements: TablePlacement[];
  activeSpin: ResolvedSpin | null;
  agentStatus: AgentStatus;
  ecosystem: EcosystemState;
  settings: GameSettings;
}

export interface CollectibleDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  duplicateCoins: number;
  effect: { kind: "idle-animation" | "particle" | "sound" | "theme" };
}

export function createInitialState(): GameState {
  return {
    schemaVersion: 1,
    revision: 0,
    wallet: 0,
    lastAwardDate: null,
    dailyLedgers: {},
    processedEvents: {},
    completedTasks: {},
    verifiedTasks: {},
    pendingVerifications: {},
    pityMisses: 0,
    ownedCollectibles: [],
    displayedCollectibles: [],
    tablePlacements: [],
    activeSpin: null,
    agentStatus: "idle",
    ecosystem: createInitialEcosystemState(),
    settings: { muted: true, reducedMotion: false, scale: 1 },
  };
}

export function createInitialEcosystemState(): EcosystemState {
  return {
    discovered: ["goldfish", "carrot-seed", "chick"],
    selected: {
      aquarium: "goldfish",
      garden: "carrot-seed",
      animals: "chick",
    },
    supplies: { fishFeed: 1, fertilizer: 1, animalFeed: 1 },
    progress: { aquarium: 0, garden: 0, animals: 0 },
    milestones: { aquarium: 0, garden: 0, animals: 0 },
    harmony: 0,
    lifecycle: {
      lastSimulatedAt: null,
      fish: {
        goldfish: { count: 1, growth: 0, boostedUntil: null },
      },
      plots: {
        "1": { seedId: "carrot-seed", growth: 0, readyYield: 0, boostedUntil: null, generation: 1 },
        "2": { seedId: null, growth: 0, readyYield: 0, boostedUntil: null, generation: 0 },
        "3": { seedId: null, growth: 0, readyYield: 0, boostedUntil: null, generation: 0 },
        "4": { seedId: null, growth: 0, readyYield: 0, boostedUntil: null, generation: 0 },
        "5": { seedId: null, growth: 0, readyYield: 0, boostedUntil: null, generation: 0 },
        "6": { seedId: null, growth: 0, readyYield: 0, boostedUntil: null, generation: 0 },
      },
      livestock: {
        chick: {
          adults: 0,
          juveniles: 1,
          juvenileGrowth: 0,
          production: 0,
          readyProducts: 0,
          boostedUntil: null,
          generation: 1,
        },
      },
      produce: {},
    },
  };
}
