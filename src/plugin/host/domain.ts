import type { HostState } from "../shared/contracts";

export interface GameDomain {
  readonly global: {
    get(): HostState;
    set(next: HostState): Promise<void>;
  };
  close(): Promise<void>;
}

export function createInitialHostState(): HostState {
  return {
    schemaVersion: 2,
    revision: 0,
    wallet: 0,
    lastGrantedLocalDate: null,
    daily: {},
    tokenEnergy: { progress: 0, dailyCoins: {} },
    tokenUsageWatermarks: {},
    pityCount: 0,
    inventory: [],
    displaySlots: [],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    recentCommands: {},
  };
}
