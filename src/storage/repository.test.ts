import { describe, expect, it } from "vitest";
import { createInitialState, type GameState, type ResolvedReward } from "../domain/types";
import {
  RevisionConflictError,
  STATE_KEY,
  StateRepository,
  StorageWriteError,
} from "./repository";
import { parseGameState } from "./schema";

const ISO_DATE = "2026-08-26T12:00:00.000Z";
const DATE_KEY = "2026-08-26";
const RESERVED_RECORD_KEYS = ["__proto__", "constructor", "prototype"] as const;

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  failWrite: ((key: string) => unknown) | undefined;

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    const failure = this.failWrite?.(key);
    if (failure !== undefined) {
      throw failure;
    }

    this.writes.push({ key, value });
    this.data.set(key, value);
  }

  seed(key: string, value: string) {
    this.data.set(key, value);
  }
}

function populatedState(): GameState {
  return {
    ...createInitialState(),
    wallet: 12,
    lastAwardDate: DATE_KEY,
    dailyLedgers: {
      [DATE_KEY]: {
        workCoins: 25,
        focusMinutes: 541,
        settledFocusHours: 8,
        focusCoins: 16,
      },
    },
    processedEvents: { "event-1": ISO_DATE },
    completedTasks: { "task-1": ISO_DATE },
    verifiedTasks: { "task-2": ISO_DATE },
    pendingVerifications: {
      "task-3": { eventId: "event-3", occurredAt: ISO_DATE },
    },
    pityMisses: 10,
    ownedCollectibles: ["plant", "crystal"],
    displayedCollectibles: ["plant"],
    agentStatus: "working",
    settings: { muted: false, reducedMotion: true, scale: 2 },
  };
}

function stateWithReward(reward: ResolvedReward): GameState {
  const state = populatedState();
  state.activeSpin = {
    id: "spin-1",
    stage: "spinning",
    reels: ["coin", "leaf", "crystal"],
    reward,
    pityAfter: 3,
    createdAt: ISO_DATE,
  };
  return state;
}

function reservedKeyRecord<T>(createValue: (key: string) => T): Record<string, T> {
  return Object.fromEntries(RESERVED_RECORD_KEYS.map((key) => [key, createValue(key)]));
}

describe("GameStateSchema", () => {
  it.each(["idle", "working", "completed", "error"] as const)(
    "accepts the %s agent status",
    (agentStatus) => {
      const state = populatedState();
      state.agentStatus = agentStatus;

      expect(parseGameState(state).agentStatus).toBe(agentStatus);
    },
  );

  it.each(["coin-inserted", "spinning", "highlight", "payout", "settled"] as const)(
    "accepts the %s spin stage",
    (stage) => {
      const state = stateWithReward({ kind: "none" });
      state.activeSpin!.stage = stage;

      expect(parseGameState(state).activeSpin?.stage).toBe(stage);
    },
  );

  it.each([
    { kind: "none" },
    { kind: "coins", amount: 1, reason: "refund" },
    { kind: "coins", amount: 5, reason: "five-coins" },
    { kind: "coins", amount: 9, reason: "pity-fallback" },
    { kind: "coins", amount: 12, reason: "robot-fallback" },
    {
      kind: "collectible",
      collectibleId: "plant",
      isDuplicate: true,
      conversionCoins: 3,
      bonusCoins: 2,
    },
    {
      kind: "ecosystem-item",
      itemId: "moon-carp",
      isDuplicate: true,
      conversionCoins: 12,
    },
  ] satisfies ResolvedReward[])("accepts the $kind reward variant", (reward) => {
    expect(parseGameState(stateWithReward(reward)).activeSpin?.reward).toEqual(reward);
  });

  it("accepts every reel symbol and both settings scales", () => {
    const first = stateWithReward({ kind: "none" });
    first.activeSpin!.reels = ["moon", "robot", "coin"];
    first.settings.scale = 1;
    const second = stateWithReward({ kind: "none" });
    second.activeSpin!.reels = ["leaf", "crystal", "moon"];
    second.settings.scale = 2;

    expect(parseGameState(first).activeSpin?.reels).toEqual(["moon", "robot", "coin"]);
    expect(parseGameState(second).settings.scale).toBe(2);
  });

  it("round-trips the optional desktop companion scale", () => {
    const state = populatedState();
    state.settings.companionScale = 1.25;

    expect(parseGameState(state).settings.companionScale).toBe(1.25);
  });

  it.each([
    ["negative revision", (state: GameState) => { state.revision = -1; }],
    ["fractional wallet", (state: GameState) => { state.wallet = 1.5; }],
    ["NaN pity count", (state: GameState) => { state.pityMisses = Number.NaN; }],
    ["infinite focus minutes", (state: GameState) => {
      state.dailyLedgers[DATE_KEY]!.focusMinutes = Number.POSITIVE_INFINITY;
    }],
    ["negative settled focus hours", (state: GameState) => {
      state.dailyLedgers[DATE_KEY]!.settledFocusHours = -1;
    }],
    ["work coins over 25", (state: GameState) => {
      state.dailyLedgers[DATE_KEY]!.workCoins = 26;
    }],
    ["focus coins over 16", (state: GameState) => {
      state.dailyLedgers[DATE_KEY]!.focusCoins = 17;
    }],
  ] as const)("rejects %s", (_description, mutate) => {
    const state = populatedState();
    mutate(state);

    expect(() => parseGameState(state)).toThrow();
  });

  it.each([
    ["coin amount", { kind: "coins", amount: Number.NEGATIVE_INFINITY, reason: "refund" }],
    ["collectible conversion", {
      kind: "collectible",
      collectibleId: "plant",
      isDuplicate: true,
      conversionCoins: -1,
      bonusCoins: 0,
    }],
    ["collectible bonus", {
      kind: "collectible",
      collectibleId: "plant",
      isDuplicate: false,
      conversionCoins: 0,
      bonusCoins: 0.5,
    }],
    ["ecosystem conversion", {
      kind: "ecosystem-item",
      itemId: "goldfish",
      isDuplicate: true,
      conversionCoins: -1,
    }],
  ] as const)("rejects an invalid %s", (_description, reward) => {
    expect(() => parseGameState(stateWithReward(reward as ResolvedReward))).toThrow();
  });

  it.each([
    ["last award date", (state: GameState) => { state.lastAwardDate = "2026-02-30"; }],
    ["daily ledger key", (state: GameState) => {
      state.dailyLedgers = { "2026-13-01": state.dailyLedgers[DATE_KEY]! };
    }],
    ["processed event timestamp", (state: GameState) => {
      state.processedEvents["event-2"] = "yesterday";
    }],
    ["pending verification timestamp", (state: GameState) => {
      state.pendingVerifications["task-3"]!.occurredAt = "2026-02-30";
    }],
    ["spin timestamp", (state: GameState) => {
      state.activeSpin = stateWithReward({ kind: "none" }).activeSpin;
      state.activeSpin!.createdAt = "not-a-date";
    }],
  ] as const)("rejects an invalid %s", (_description, mutate) => {
    const state = populatedState();
    mutate(state);

    expect(() => parseGameState(state)).toThrow();
  });

  it.each([
    "processedEvents",
    "completedTasks",
    "verifiedTasks",
    "pendingVerifications",
  ] as const)("rejects empty keys in %s", (recordName) => {
    const state = populatedState();
    const existingValue = Object.values(state[recordName])[0]!;
    (state[recordName] as Record<string, typeof existingValue>) = { "": existingValue };

    expect(() => parseGameState(state)).toThrow();
  });

  it.each(["ownedCollectibles", "displayedCollectibles"] as const)(
    "rejects duplicates and empty IDs in %s",
    (field) => {
      const duplicateState = populatedState();
      duplicateState[field] = ["plant", "plant"];
      const emptyState = populatedState();
      emptyState[field] = [""];

      expect(() => parseGameState(duplicateState)).toThrow();
      expect(() => parseGameState(emptyState)).toThrow();
    },
  );

  it("rejects unknown union members and extra state fields", () => {
    const invalid = { ...populatedState(), agentStatus: "paused", unexpected: true };

    expect(() => parseGameState(invalid)).toThrow();
  });

  it.each(["processedEvents", "completedTasks", "verifiedTasks"] as const)(
    "preserves reserved own keys in %s without a mutable object prototype",
    (field) => {
      const state = populatedState();
      state[field] = reservedKeyRecord(() => ISO_DATE);

      const parsed = parseGameState(state);

      expect(Object.keys(parsed[field])).toEqual(RESERVED_RECORD_KEYS);
      expect(Object.getPrototypeOf(parsed[field])).toBeNull();
      for (const key of RESERVED_RECORD_KEYS) {
        expect(Object.hasOwn(parsed[field], key)).toBe(true);
        expect(parsed[field][key]).toBe(ISO_DATE);
      }
    },
  );

  it("preserves reserved pending-verification keys without a mutable object prototype", () => {
    const state = populatedState();
    state.pendingVerifications = reservedKeyRecord((key) => ({
      eventId: `event-${key}`,
      occurredAt: ISO_DATE,
    }));

    const parsed = parseGameState(state);

    expect(Object.keys(parsed.pendingVerifications)).toEqual(RESERVED_RECORD_KEYS);
    expect(Object.getPrototypeOf(parsed.pendingVerifications)).toBeNull();
    for (const key of RESERVED_RECORD_KEYS) {
      expect(Object.hasOwn(parsed.pendingVerifications, key)).toBe(true);
      expect(parsed.pendingVerifications[key]?.eventId).toBe(`event-${key}`);
    }
  });

  it("emits the date-keyed daily-ledger map without a mutable object prototype", () => {
    const parsed = parseGameState(populatedState());

    expect(Object.keys(parsed.dailyLedgers)).toEqual([DATE_KEY]);
    expect(Object.getPrototypeOf(parsed.dailyLedgers)).toBeNull();
    expect(Object.hasOwn(parsed.dailyLedgers, DATE_KEY)).toBe(true);
  });

  it("upgrades a legacy ecosystem snapshot with a fresh time-based lifecycle", () => {
    const state = populatedState();
    const { lifecycle: _legacyMissingLifecycle, ...legacyEcosystem } = state.ecosystem;
    const legacy = { ...state, ecosystem: legacyEcosystem } as unknown;

    const parsed = parseGameState(legacy);

    expect(parsed.ecosystem.lifecycle).toMatchObject({
      lastSimulatedAt: null,
      fish: { goldfish: { count: 1, growth: 0 } },
      plots: { "1": { seedId: "carrot-seed", growth: 0, readyYield: 0 } },
      livestock: { chick: { adults: 0, juveniles: 1, juvenileGrowth: 0 } },
      produce: {},
    });
  });

  it.each([
    ["lower", "1000-01-01", "1000-01-01T00:00:00.000Z"],
    ["upper", "9999-12-31", "9999-12-31T23:59:59.999Z"],
  ] as const)("accepts the %s supported date and timestamp boundary", (_boundary, date, timestamp) => {
    const state = populatedState();
    state.lastAwardDate = date;
    state.dailyLedgers = { [date]: state.dailyLedgers[DATE_KEY]! };
    state.processedEvents = { "event-boundary": timestamp };
    state.pendingVerifications = {
      "task-boundary": { eventId: "event-boundary", occurredAt: timestamp },
    };
    state.activeSpin = stateWithReward({ kind: "none" }).activeSpin;
    state.activeSpin!.createdAt = timestamp;

    const parsed = parseGameState(state);

    expect(parsed.lastAwardDate).toBe(date);
    expect(parsed.processedEvents["event-boundary"]).toBe(timestamp);
  });

  it.each([
    "0000-01-01",
    "0099-12-31",
    "0999-12-31",
    "10000-01-01",
    "999999999-01-01",
  ])("rejects unsupported calendar year in date key %s", (date) => {
    const state = populatedState();
    state.lastAwardDate = date as GameState["lastAwardDate"];

    expect(() => parseGameState(state)).toThrow();
  });

  it.each([
    "0000-01-01T00:00:00.000Z",
    "0099-12-31T23:59:59.999Z",
    "0999-12-31T23:59:59.999Z",
    "10000-01-01T00:00:00.000Z",
  ])("rejects unsupported calendar year in timestamp %s", (timestamp) => {
    const state = populatedState();
    state.processedEvents = { "event-out-of-range": timestamp };

    expect(() => parseGameState(state)).toThrow();
  });
});

describe("StateRepository", () => {
  it("round-trips one validated snapshot with one synchronous state write", () => {
    const storage = new MemoryStorage();
    const repo = new StateRepository(storage);
    const state = populatedState();

    const saved = repo.save(state, 0);

    expect(saved.revision).toBe(1);
    expect(state.revision).toBe(0);
    expect(repo.load()).toEqual(saved);
    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0]?.key).toBe(STATE_KEY);
    expect(JSON.parse(storage.writes[0]!.value)).toEqual(saved);
  });

  it("round-trips every reserved own key in all identifier-keyed maps", () => {
    const storage = new MemoryStorage();
    const state = populatedState();
    state.processedEvents = reservedKeyRecord(() => ISO_DATE);
    state.completedTasks = reservedKeyRecord(() => ISO_DATE);
    state.verifiedTasks = reservedKeyRecord(() => ISO_DATE);
    state.pendingVerifications = reservedKeyRecord((key) => ({
      eventId: `event-${key}`,
      occurredAt: ISO_DATE,
    }));

    const saved = new StateRepository(storage).save(state, 0);
    const loaded = new StateRepository(storage).load();

    for (const field of [
      "processedEvents",
      "completedTasks",
      "verifiedTasks",
      "pendingVerifications",
    ] as const) {
      expect(Object.keys(saved[field])).toEqual(RESERVED_RECORD_KEYS);
      expect(Object.keys(loaded[field])).toEqual(RESERVED_RECORD_KEYS);
      expect(Object.getPrototypeOf(saved[field])).toBeNull();
      expect(Object.getPrototypeOf(loaded[field])).toBeNull();
    }
    expect(Object.keys(loaded.dailyLedgers)).toEqual([DATE_KEY]);
    expect(Object.getPrototypeOf(loaded.dailyLedgers)).toBeNull();
    expect(storage.writes).toHaveLength(1);
  });

  it("returns safe defaults without writing when no snapshot exists", () => {
    const storage = new MemoryStorage();

    expect(new StateRepository(storage).load()).toEqual(createInitialState());
    expect(storage.writes).toEqual([]);
  });

  it("rejects a stale expected revision without writing", () => {
    const storage = new MemoryStorage();
    const repo = new StateRepository(storage);
    repo.save(createInitialState(), 0);

    expect(() => repo.save(createInitialState(), 0)).toThrow(RevisionConflictError);
    expect(storage.writes).toHaveLength(1);
  });

  it.each([
    ["invalid JSON", "not-json"],
    ["invalid schema", JSON.stringify({ ...createInitialState(), wallet: -1 })],
  ])("backs up %s and recovers safe defaults", (_description, raw) => {
    const storage = new MemoryStorage();
    storage.seed(STATE_KEY, raw);
    const repo = new StateRepository(storage, () => ISO_DATE);

    expect(repo.load()).toEqual(createInitialState());
    expect(storage.getItem(`dsh-slot-corrupt-${ISO_DATE}`)).toBe(raw);
    expect(storage.getItem(STATE_KEY)).toBeNull();
  });

  it("still recovers safe defaults when a corrupt backup cannot be written", () => {
    const storage = new MemoryStorage();
    storage.seed(STATE_KEY, "not-json");
    storage.failWrite = (key) => key.startsWith("dsh-slot-corrupt-")
      ? new DOMException("quota exceeded", "QuotaExceededError")
      : undefined;

    expect(new StateRepository(storage, () => ISO_DATE).load()).toEqual(createInitialState());
    expect(storage.getItem(STATE_KEY)).toBeNull();
  });

  it("refuses to overwrite an invalid current snapshot during save", () => {
    const storage = new MemoryStorage();
    storage.seed(STATE_KEY, JSON.stringify({ ...createInitialState(), revision: 0, wallet: -1 }));
    const repo = new StateRepository(storage, () => ISO_DATE);

    expect(() => repo.save(createInitialState(), 0)).toThrow();
    expect(storage.writes).toEqual([]);
    expect(storage.getItem(`dsh-slot-corrupt-${ISO_DATE}`)).toBeNull();
  });

  it("validates the next snapshot before writing", () => {
    const storage = new MemoryStorage();
    const repo = new StateRepository(storage);
    const invalid = createInitialState();
    invalid.wallet = -1;

    expect(() => repo.save(invalid, 0)).toThrow();
    expect(storage.writes).toEqual([]);
  });

  it("wraps a quota or write exception in StorageWriteError without changing storage", () => {
    const storage = new MemoryStorage();
    const cause = new DOMException("quota exceeded", "QuotaExceededError");
    storage.failWrite = (key) => key === STATE_KEY ? cause : undefined;

    let thrown: unknown;
    try {
      new StateRepository(storage).save(createInitialState(), 0);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StorageWriteError);
    expect((thrown as Error & { cause?: unknown }).cause).toBe(cause);
    expect(storage.getItem(STATE_KEY)).toBeNull();
  });
});
