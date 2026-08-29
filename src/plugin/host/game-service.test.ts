import { describe, expect, it } from "vitest";
import { FixedClock } from "../../time/clock";
import type {
  CommandRequest,
  EligibleTurnUsage,
  HostState,
} from "../shared/contracts";
import { hostStateSchema } from "../shared/contracts";
import type { GameDomain } from "./domain";
import { GameService } from "./game-service";
import type { SessionEventLike, SessionLike } from "./session-usage";

const NOW = new Date("2026-08-26T04:00:00.000Z");

class MemoryDomain implements GameDomain {
  failNextWrite = false;
  writeCount = 0;
  writeDelay: Promise<void> | null = null;
  readonly writeStarted: Promise<void>;
  private state: HostState;
  private reportWriteStarted!: () => void;

  constructor(initial: HostState) {
    this.state = structuredClone(initial);
    this.writeStarted = new Promise((resolve) => { this.reportWriteStarted = resolve; });
  }

  readonly global = {
    get: (): HostState => structuredClone(this.state),
    set: async (next: HostState): Promise<void> => {
      this.writeCount += 1;
      this.reportWriteStarted();
      if (this.failNextWrite) {
        this.failNextWrite = false;
        throw new Error("storage unavailable");
      }
      if (this.writeDelay !== null) await this.writeDelay;
      this.state = hostStateSchema.parse(structuredClone(next));
    },
  };

  async close(): Promise<void> {}

  persisted(): HostState {
    return structuredClone(this.state);
  }
}

function state(overrides: Partial<HostState> = {}): HostState {
  return {
    schemaVersion: 3,
    revision: 0,
    wallet: 0,
    lastGrantedLocalDate: null,
    daily: {},
    tokenEnergy: { progress: 0, dailyCoins: {} },
    tokenUsageWatermarks: {},
    pityCount: 0,
    inventory: [],
    displaySlots: [],
    tablePlacements: [],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    recentCommands: {},
    ...overrides,
  };
}

function request(
  type: "claimDaily" | "insertCoin",
  sequence: number,
  expectedRevision = 0,
): Extract<CommandRequest, { type: typeof type }> {
  return {
    type,
    commandId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    sessionId: "session-1",
    expectedRevision,
    issuedAt: NOW.toISOString(),
  } as Extract<CommandRequest, { type: typeof type }>;
}

function service(domain: MemoryDomain, clock = new FixedClock(NOW)): GameService {
  let nextId = 1;
  return new GameService(domain, {
    clock,
    rng: { next: () => 0.7 },
    createId: () => `spin-${nextId++}`,
  });
}

function usage(sequence: number, outputTokens = 1_500): EligibleTurnUsage {
  return {
    sessionId: "session-1",
    turn: sequence === 13 ? 1 : 2,
    usageSeqs: [sequence],
    stepUsages: [{ inputTokens: 0, outputTokens }],
    occurredAt: new Date(NOW.getTime() + sequence).toISOString(),
  };
}

function sessionHistory(...sequences: number[]): SessionLike {
  return sessionHistoryFor("session-1", ...sequences);
}

function sessionHistoryFor(sessionId: string, ...sequences: number[]): SessionLike {
  const events: SessionEventLike[] = [];
  for (const [index, sequence] of sequences.entries()) {
    const turn = index + 1;
    events.push(
      { type: "turn/start", seq: sequence - 3, time: NOW.getTime() + sequence - 3, data: { turn } },
      {
        type: "user/message",
        seq: sequence - 2,
        time: NOW.getTime() + sequence - 2,
        data: { source: { kind: "user" } },
      },
      {
        type: "assistant/message",
        seq: sequence,
        time: NOW.getTime() + sequence,
        data: {
          turn,
          step: 1,
          usage: { inputTokens: 0, outputTokens: 1_500 },
        },
      },
      {
        type: "turn/end",
        seq: sequence + 1,
        time: NOW.getTime() + sequence + 1,
        data: { turn, reason: { kind: "completed" } },
      },
    );
  }
  return {
    id: sessionId,
    header: { version: 0, id: sessionId, createdAt: NOW.getTime() - 1_000 },
    events,
  };
}

describe("authoritative game service", () => {
  it("persists chosen table positions and returns a replaced occupant to storage atomically", async () => {
    const domain = new MemoryDomain(state({ inventory: ["plant", "crystal"] }));
    const game = service(domain);
    const base = {
      sessionId: "session-1",
      issuedAt: NOW.toISOString(),
    };

    const plant = await game.command({
      ...base,
      type: "setPlacement",
      commandId: "00000000-0000-4000-8000-000000000101",
      expectedRevision: 0,
      itemId: "plant",
      positionId: "left-front-round",
    });
    expect(plant).toMatchObject({
      status: 200,
      snapshot: {
        revision: 1,
        displaySlots: ["plant"],
        tablePlacements: [{ itemId: "plant", positionId: "left-front-round" }],
      },
    });

    const replaced = await game.command({
      ...base,
      type: "setPlacement",
      commandId: "00000000-0000-4000-8000-000000000102",
      expectedRevision: 1,
      itemId: "crystal",
      positionId: "left-front-round",
    });
    expect(replaced).toMatchObject({
      status: 200,
      snapshot: {
        revision: 2,
        displaySlots: ["crystal"],
        tablePlacements: [{ itemId: "crystal", positionId: "left-front-round" }],
      },
    });
    expect(domain.persisted()).toMatchObject({
      revision: 2,
      displaySlots: ["crystal"],
      tablePlacements: [{ itemId: "crystal", positionId: "left-front-round" }],
    });

    const returned = await game.command({
      ...base,
      type: "setPlacement",
      commandId: "00000000-0000-4000-8000-000000000103",
      expectedRevision: 2,
      itemId: "crystal",
      positionId: null,
    });
    expect(returned).toMatchObject({
      status: 200,
      snapshot: { revision: 3, displaySlots: [], tablePlacements: [] },
    });
  });

  it("does not expose wallet, revision, or command receipt when storage rejects", async () => {
    const domain = new MemoryDomain(state({ wallet: 2 }));
    domain.failNextWrite = true;
    const game = service(domain);

    await expect(game.command(request("insertCoin", 1))).rejects.toThrow("storage unavailable");

    expect(domain.persisted()).toMatchObject({
      revision: 0,
      wallet: 2,
      pendingSpin: null,
      recentCommands: {},
    });
  });

  it("commits usage reward and receipt together or neither", async () => {
    const domain = new MemoryDomain(state());
    domain.failNextWrite = true;
    const game = service(domain);
    const usage: EligibleTurnUsage = {
      sessionId: "session-1",
      turn: 1,
      usageSeqs: [13],
      stepUsages: [{ inputTokens: 0, outputTokens: 3_000 }],
      occurredAt: NOW.toISOString(),
    };

    await expect(game.acceptUsage(usage)).rejects.toThrow("storage unavailable");
    expect(domain.persisted()).toMatchObject({
      revision: 0,
      wallet: 0,
      tokenUsageWatermarks: {},
    });
  });

  it("rejects duplicate usage after a Host restart from the persisted watermark", async () => {
    const domain = new MemoryDomain(state());
    const usage: EligibleTurnUsage = {
      sessionId: "session-1",
      turn: 1,
      usageSeqs: [13],
      stepUsages: [{ inputTokens: 0, outputTokens: 3_000 }],
      occurredAt: NOW.toISOString(),
    };

    await service(domain).acceptUsage(usage);
    await service(domain).acceptUsage(usage);

    expect(domain.persisted()).toMatchObject({
      revision: 1,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-1": 13 },
    });
  });

  it("blocks higher sequences after a lower write failure until restart replays both", async () => {
    const domain = new MemoryDomain(state());
    const failedGeneration = service(domain);
    domain.failNextWrite = true;

    await expect(failedGeneration.acceptUsage(usage(13))).rejects.toThrow("storage unavailable");
    await expect(failedGeneration.acceptUsage(usage(23))).resolves.toBeUndefined();
    expect(domain.persisted()).toMatchObject({
      revision: 0,
      wallet: 0,
      tokenEnergy: { progress: 0 },
      tokenUsageWatermarks: {},
    });

    const restarted = service(domain);
    await restarted.adoptSession(sessionHistory(13, 23));
    expect(domain.persisted()).toMatchObject({
      revision: 2,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-1": 23 },
    });

    const secondRestart = service(domain);
    await secondRestart.adoptSession(sessionHistory(13, 23));
    expect(domain.persisted()).toMatchObject({ revision: 2, wallet: 0 });
  });

  it("buffers live high sequences until lower history adoption completes", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const liveHigh = sessionHistory(23);
    for (const event of liveHigh.events) await game.acceptSessionEvent(liveHigh, event);

    await game.adoptSession(sessionHistory(13));
    await game.completeUsageBootstrap();

    expect(domain.persisted()).toMatchObject({
      revision: 2,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-1": 23 },
    });
  });

  it("keeps a live open turn intact while adopting an earlier authoritative prefix", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const live = sessionHistory(13, 23);

    for (const event of live.events.slice(4, 6)) {
      await game.acceptSessionEvent(live, event);
    }
    await game.adoptSession(sessionHistory(13));
    await game.completeUsageBootstrap();
    for (const event of live.events.slice(6)) {
      await game.acceptSessionEvent(live, event);
    }

    expect(domain.persisted()).toMatchObject({
      revision: 2,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-1": 23 },
    });
  });

  it("continues an adopted open prefix with raw assistant and end events buffered at bootstrap", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const full = sessionHistory(13);
    const prefix = { ...full, events: full.events.slice(0, 2) };

    await game.adoptSession(prefix);
    for (const event of full.events.slice(2)) {
      await game.acceptSessionEvent(full, event);
    }
    await game.completeUsageBootstrap();

    expect(domain.persisted()).toMatchObject({
      revision: 1,
      wallet: 0,
      tokenEnergy: { progress: 1_500 },
      tokenUsageWatermarks: { "session-1": 13 },
    });
  });

  it("drains raw events appended during a bootstrap storage await before switching live", async () => {
    const domain = new MemoryDomain(state());
    let releaseWrite!: () => void;
    domain.writeDelay = new Promise((resolve) => { releaseWrite = resolve; });
    const game = service(domain);
    const first = sessionHistory(13);
    for (const event of first.events) await game.acceptSessionEvent(first, event);

    const completion = game.completeUsageBootstrap();
    await domain.writeStarted;
    const second = sessionHistory(23);
    for (const event of second.events) await game.acceptSessionEvent(second, event);
    releaseWrite();
    await completion;

    expect(domain.persisted()).toMatchObject({
      revision: 2,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-1": 23 },
    });
  });

  it("adopts a cold open prefix before its first post-bootstrap assistant event", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const full = sessionHistory(13);
    const openPrefix = { ...full, events: full.events.slice(0, 2) };

    await game.completeUsageBootstrap();
    await game.acceptSessionEvent(openPrefix, full.events[2]);
    await game.acceptSessionEvent(full, full.events[3]);

    expect(domain.persisted()).toMatchObject({
      revision: 1,
      wallet: 0,
      tokenEnergy: { progress: 1_500 },
      tokenUsageWatermarks: { "session-1": 13 },
    });
  });

  it("fills legacy receipt holes before atomically pruning the one-time receipt map", async () => {
    const migrated = hostStateSchema.parse({
      schemaVersion: 1,
      revision: 1,
      wallet: 0,
      lastGrantedLocalDate: null,
      daily: {},
      tokenEnergy: { progress: 1_500, dailyCoins: {} },
      tokenUsageReceipts: { "session-1:23": true },
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    });
    const domain = new MemoryDomain(migrated);
    const game = service(domain);
    const overlappingLiveHole = sessionHistory(13);
    for (const event of overlappingLiveHole.events) {
      await game.acceptSessionEvent(overlappingLiveHole, event);
    }

    const writesBeforeAdopt = domain.writeCount;
    await game.adoptSession(sessionHistory(13, 23));
    await game.completeUsageBootstrap();

    expect(domain.persisted()).toMatchObject({
      schemaVersion: 3,
      revision: 3,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-1": 23 },
    });
    expect(domain.persisted()).not.toHaveProperty("legacyTokenUsageReceipts");
    expect(domain.writeCount - writesBeforeAdopt).toBe(1);
  });

  it("retains cold legacy receipts until that session resumes and migrates atomically", async () => {
    const migrated = hostStateSchema.parse({
      schemaVersion: 1,
      revision: 1,
      wallet: 0,
      lastGrantedLocalDate: null,
      daily: {},
      tokenEnergy: { progress: 1_500, dailyCoins: {} },
      tokenUsageReceipts: { "session-cold:23": true },
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    });
    const domain = new MemoryDomain(migrated);
    const game = service(domain);

    await game.completeUsageBootstrap();
    expect(domain.persisted().legacyTokenUsageReceipts).toEqual({
      "session-cold": { "23": true },
    });

    const writesBeforeResume = domain.writeCount;
    const resumed = sessionHistoryFor("session-cold", 13, 23);
    for (const event of resumed.events) await game.acceptSessionEvent(resumed, event);

    expect(domain.persisted()).toMatchObject({
      revision: 3,
      wallet: 0,
      tokenEnergy: { progress: 3_000 },
      tokenUsageWatermarks: { "session-cold": 23 },
    });
    expect(domain.persisted()).not.toHaveProperty("legacyTokenUsageReceipts");
    expect(domain.writeCount - writesBeforeResume).toBe(1);
  });

  it("serializes concurrent insertCoin commands against fresh authoritative state", async () => {
    const domain = new MemoryDomain(state({ wallet: 2 }));
    const game = service(domain);

    const [first, second] = await Promise.all([
      game.command(request("insertCoin", 2)),
      game.command(request("insertCoin", 3)),
    ]);

    expect(first).toMatchObject({ status: 200, snapshot: { revision: 1, wallet: 1 } });
    expect(second).toMatchObject({
      status: 409,
      errorCode: "revision-conflict",
      snapshot: { revision: 1, wallet: 1 },
    });
    expect(domain.persisted()).toMatchObject({ revision: 1, wallet: 1 });
  });

  it("rejects a stale expected revision without writing", async () => {
    const domain = new MemoryDomain(state({ revision: 4, wallet: 2 }));
    const game = service(domain);

    expect(await game.command(request("insertCoin", 4, 3))).toMatchObject({
      status: 409,
      errorCode: "revision-conflict",
      snapshot: { revision: 4, wallet: 2 },
    });
    expect(domain.persisted().recentCommands).toEqual({});
  });

  it("returns the saved success for the same command id and canonical payload", async () => {
    const domain = new MemoryDomain(state({ wallet: 2 }));
    const game = service(domain);
    const original = request("insertCoin", 5);

    const first = await game.command(original);
    const retry = await game.command({ ...original, expectedRevision: 99 });

    expect(retry).toEqual(first);
    expect(domain.persisted()).toMatchObject({ revision: 1, wallet: 1 });
  });

  it("replays a durable command result with current generation Agent status", async () => {
    const domain = new MemoryDomain(state({ wallet: 2 }));
    const firstGeneration = service(domain);
    firstGeneration.acceptAgentStatus("session-1", "agent-a", "running");
    const original = request("insertCoin", 15);

    const first = await firstGeneration.command(original);
    expect(first.snapshot.agentStatus).toBe("working");

    const receipt = domain.persisted().recentCommands[original.commandId];
    expect(receipt?.snapshot).not.toHaveProperty("agentStatus");

    const restarted = service(domain);
    const replay = await restarted.command({ ...original, expectedRevision: 99 });
    expect(replay.snapshot).toEqual({ ...first.snapshot, agentStatus: "idle" });
  });

  it("rejects reuse of one command id for a different payload", async () => {
    const domain = new MemoryDomain(state({ wallet: 2 }));
    const game = service(domain);
    const original = request("insertCoin", 6);
    await game.command(original);

    const reused = await game.command({
      ...original,
      type: "claimDaily",
      expectedRevision: 1,
    });

    expect(reused).toMatchObject({ status: 409, errorCode: "command-id-reused" });
    expect(domain.persisted()).toMatchObject({ revision: 1, wallet: 1 });
  });

  it("does not award a settled spin twice when the response is retried", async () => {
    const domain = new MemoryDomain(state({ wallet: 2 }));
    const game = service(domain);
    const inserted = await game.command(request("insertCoin", 7));
    const spinId = inserted.snapshot.pendingSpin?.id;
    expect(spinId).toBe("spin-1");
    if (spinId === undefined) return;

    await game.command({
      ...request("insertCoin", 8, 1),
      type: "pullLever",
      spinId,
    });
    const settle = {
      ...request("insertCoin", 9, 2),
      type: "settleSpin" as const,
      spinId,
    };
    const first = await game.command(settle);
    const retry = await game.command({ ...settle, expectedRevision: 99 });

    expect(first).toMatchObject({
      status: 200,
      snapshot: { revision: 3, wallet: 6, pendingSpin: null },
    });
    expect(retry).toEqual(first);
    expect(domain.persisted()).toMatchObject({ revision: 3, wallet: 6, pendingSpin: null });
  });

  it("grants three coins once per later local date and rejects clock rollback", async () => {
    const clock = new FixedClock(NOW);
    const domain = new MemoryDomain(state());
    const game = service(domain, clock);

    expect(await game.command(request("claimDaily", 10))).toMatchObject({
      status: 200,
      snapshot: { revision: 1, wallet: 3, lastGrantedLocalDate: "2026-08-26" },
    });
    expect(await game.command(request("claimDaily", 11, 1))).toMatchObject({
      status: 200,
      snapshot: { revision: 1, wallet: 3, lastGrantedLocalDate: "2026-08-26" },
    });

    clock.set(new Date("2026-08-25T04:00:00.000Z"));
    expect(await game.command({
      ...request("claimDaily", 12, 1),
      issuedAt: "2026-08-25T04:00:00.000Z",
    })).toMatchObject({
      status: 409,
      errorCode: "clock-skew",
      snapshot: { revision: 1, wallet: 3, lastGrantedLocalDate: "2026-08-26" },
    });
    expect(domain.persisted()).toMatchObject({ revision: 1, wallet: 3 });
  });

  it("receipts a successful no-op so its command id cannot be repurposed", async () => {
    const domain = new MemoryDomain(state({
      revision: 1,
      wallet: 3,
      lastGrantedLocalDate: "2026-08-26",
    }));
    const game = service(domain);
    const noOp = request("claimDaily", 13, 1);

    expect(await game.command(noOp)).toMatchObject({
      status: 200,
      snapshot: { revision: 1, wallet: 3 },
    });
    expect(domain.persisted().recentCommands).toHaveProperty(noOp.commandId);
    expect(await game.command({ ...noOp, type: "insertCoin" })).toMatchObject({
      status: 409,
      errorCode: "command-id-reused",
      snapshot: { revision: 1, wallet: 3 },
    });
  });

  it("persists the desktop companion scale in authoritative Host settings", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const result = await game.command({
      ...request("claimDaily", 15),
      type: "updateSettings",
      patch: { companionScale: 1.25 },
    });

    expect(result).toMatchObject({
      status: 200,
      snapshot: { revision: 1, settings: { companionScale: 1.25 } },
    });
    expect(domain.persisted()).toMatchObject({
      revision: 1,
      settings: { companionScale: 1.25 },
    });
  });

  it("keeps agent activity session-local and outside economic revision", async () => {
    const domain = new MemoryDomain(state({ revision: 4 }));
    const game = service(domain);

    game.acceptAgentStatus("session-1", "agent-a", "running");
    game.acceptAgentStatus("session-1", "agent-b", "running");
    game.acceptAgentStatus("session-1", "agent-a", "idle");

    expect(await game.getSnapshot("session-1")).toMatchObject({
      revision: 4,
      agentStatus: "working",
    });
    expect(await game.getSnapshot("session-other")).toMatchObject({
      revision: 4,
      agentStatus: "idle",
    });
    game.acceptAgentStatus("session-1", "agent-b", "idle");
    expect((await game.getSnapshot("session-1")).agentStatus).toBe("idle");
    expect(domain.persisted().revision).toBe(4);
  });

  it("waits for queued durable work before generation disposal completes", async () => {
    let releaseWrite!: () => void;
    const domain = new MemoryDomain(state({ wallet: 2 }));
    domain.writeDelay = new Promise((resolve) => { releaseWrite = resolve; });
    const game = service(domain);
    const commandPromise = game.command(request("insertCoin", 14));
    await domain.writeStarted;

    let disposed = false;
    const disposal = Promise.resolve(game.dispose()).then(() => { disposed = true; });
    await Promise.resolve();
    expect(disposed).toBe(false);

    releaseWrite();
    await Promise.all([commandPromise, disposal]);
    expect(disposed).toBe(true);
  });
});
