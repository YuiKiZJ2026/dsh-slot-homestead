export type DateKey = `${number}-${number}-${number}`;
export type Rarity = "common" | "rare" | "set";
export type ReelSymbol = "coin" | "leaf" | "crystal" | "moon" | "robot";
export type AgentStatus = "idle" | "working" | "completed" | "error";

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
  activeSpin: ResolvedSpin | null;
  agentStatus: AgentStatus;
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
    activeSpin: null,
    agentStatus: "idle",
    settings: { muted: true, reducedMotion: false, scale: 1 },
  };
}
