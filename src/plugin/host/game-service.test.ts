import { describe, expect, it } from "vitest";
import { FixedClock } from "../../time/clock";
import { createInitialEcosystemState } from "../../domain/types";
import { getMerchantView } from "../../ecosystem/merchant";
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

function merchantState(): HostState {
  const initial = state({ wallet: 99 });
  initial.ecosystem.world = { elapsedMs: 0, lastRealAt: NOW.toISOString(), seed: 42 };
  const arrival = getMerchantView(initial.ecosystem).nextArrivalDay;
  initial.ecosystem.world.elapsedMs = ((arrival - 1) * 24 + 4) * 60 * 60_000;
  initial.ecosystem.lifecycle.lastSimulatedAt = new Date(Date.UTC(2000, 0, arrival, 10)).toISOString();
  return initial;
}

describe("durable merchant integration", () => {
  it("buys once across replay, stale revisions, concurrent commands and restart", async () => {
    const domain = new MemoryDomain(merchantState());
    const host = service(domain);
    const view = getMerchantView(domain.persisted().ecosystem);
    const offer = view.offers.find(item => item.kind === "supply")!;
    const trade = { ...request("claimDaily", 950), type: "merchantBuy", itemId: offer.itemId, visitId: view.visitId! };
    const [bought, competing] = await Promise.all([host.command(trade), host.command({ ...trade, commandId: request("claimDaily", 951).commandId })]);
    expect(bought).toMatchObject({ status: 200, snapshot: { wallet: 99 - offer.price, revision: 1 } });
    expect(competing).toMatchObject({ status: 409, errorCode: "revision-conflict" });
    expect(await service(domain).command(trade)).toEqual(bought);
    expect(getMerchantView((await service(domain).getSnapshot("session-1")).ecosystem).offers.find(item => item.itemId === offer.itemId)?.remaining).toBe(offer.remaining - 1);
    expect(domain.writeCount).toBe(1);
    expect(await host.command({ ...trade, visitId: "forged-visit" })).toMatchObject({ status: 409, errorCode: "command-id-reused" });
    expect(await host.command({ ...trade, commandId: request("claimDaily", 952).commandId, expectedRevision: 1, visitId: "old-visit" })).toMatchObject({ status: 409, errorCode: "stale-visit" });
    expect(domain.persisted().wallet).toBe(99 - offer.price);
  });

  it("does not charge or retain stock usage on a failed write and retries safely", async () => {
    const initial = merchantState();
    const domain = new MemoryDomain(initial);
    const host = service(domain);
    const view = getMerchantView(initial.ecosystem);
    const offer = view.offers.find(item => item.kind === "supply")!;
    const trade = { ...request("claimDaily", 953), type: "merchantBuy", itemId: offer.itemId, visitId: view.visitId! };
    domain.failNextWrite = true;
    await expect(host.command(trade)).rejects.toThrow("storage unavailable");
    expect(domain.persisted()).toEqual(initial);
    expect(await host.command(trade)).toMatchObject({ status: 200, snapshot: { wallet: 99 - offer.price } });
    expect(getMerchantView(domain.persisted().ecosystem).offers.find(item => item.itemId === offer.itemId)?.remaining).toBe(offer.remaining - 1);
  });

  it("sells ready crops atomically, receipts the sale once, and cannot resell history", async () => {
    const initial = merchantState();
    initial.ecosystem.lifecycle.plots["1"].growth = 100;
    initial.ecosystem.lifecycle.plots["1"].readyYield = 1;
    const domain = new MemoryDomain(initial);
    const host = service(domain);
    const trade = { ...request("claimDaily", 954), type: "merchantSell", habitat: "garden", visitId: getMerchantView(initial.ecosystem).visitId! };
    const sold = await host.command(trade);
    expect(sold.status).toBe(200);
    expect(sold.snapshot.wallet).toBeGreaterThan(initial.wallet);
    expect(sold.snapshot.ecosystem.lifecycle.produce.carrot).toBe(1);
    expect(sold.snapshot.ecosystem.merchant?.soldCount).toBe(1);
    expect(await service(domain).command(trade)).toEqual(sold);
    expect(await host.command({ ...trade, ...request("claimDaily", 955, 1), type: "merchantSell" })).toMatchObject({ status: 409, errorCode: "nothing-to-harvest" });
    expect(domain.writeCount).toBe(1);
    expect(() => host.command({ ...trade, habitat: "aquarium" })).toThrow();
  });

  it("rejects a stale visit after a saved clock progresses past departure", async () => {
    const initial = merchantState();
    const oldView = getMerchantView(initial.ecosystem);
    const clock = new FixedClock(NOW);
    const domain = new MemoryDomain(initial);
    const host = service(domain, clock);
    clock.set(new Date(NOW.getTime() + 24 * 60_000));
    const later = await host.getSnapshot("session-1");
    const upcomingView = getMerchantView(later.ecosystem);
    expect(upcomingView.present).toBe(false);
    expect(upcomingView.visitId).not.toBe(oldView.visitId);
    const savedBeforeRejectedTrades = domain.persisted();
    const result = await host.command({ ...request("claimDaily", 956), type: "merchantBuy", itemId: oldView.offers[0]!.itemId, visitId: oldView.visitId!, issuedAt: clock.now().toISOString() });
    expect(result).toMatchObject({ status: 409, errorCode: "stale-visit" });
    const tooEarly = await host.command({ ...request("claimDaily", 957), type: "merchantBuy", itemId: upcomingView.offers[0]!.itemId, visitId: upcomingView.visitId!, issuedAt: clock.now().toISOString() });
    expect(tooEarly).toMatchObject({ status: 409, errorCode: "merchant-away" });
    expect(domain.persisted().wallet).toBe(99);
    expect(domain.persisted()).toEqual(savedBeforeRejectedTrades);
    expect(getMerchantView(domain.persisted().ecosystem).offers).toEqual(upcomingView.offers);
  });
});

describe("homestead journal host integration", () => {
  it("refunds a cancelled planting plan once across replay and restart without losing harvest", async () => {
    const initial = state();
    const plot = initial.ecosystem.lifecycle.plots["1"];
    plot.growth = 100;
    plot.readyYield = 1;
    plot.nextSeedId = "carrot-seed";
    initial.ecosystem.supplies.fertilizer = 0;
    const domain = new MemoryDomain(initial);
    const cancel = { ...request("claimDaily", 420), type: "cancelPlanting", plotId: "1" };
    const first = await service(domain).command(cancel);
    expect(first).toMatchObject({ status: 200, snapshot: { revision: 1, ecosystem: { supplies: { fertilizer: 1 } } } });
    expect(first.snapshot.ecosystem.lifecycle.plots["1"]).toMatchObject({ growth: 100, readyYield: 1, seedId: "carrot-seed" });
    expect(first.snapshot.ecosystem.lifecycle.plots["1"].nextSeedId).toBeUndefined();
    expect(await service(domain).command(cancel)).toEqual(first);
    const duplicate = await service(domain).command({ ...cancel, ...request("claimDaily", 421, 1), type: "cancelPlanting" });
    expect(duplicate).toMatchObject({ status: 409, errorCode: "no-planting-plan" });
    expect(domain.persisted().ecosystem.supplies.fertilizer).toBe(1);
    expect(domain.writeCount).toBe(1);
    expect(await service(domain).command({ ...cancel, plotId: "2" })).toMatchObject({ status: 409, errorCode: "command-id-reused" });
  });

  it("serializes competing cancellations, keeps stale revisions from refunding twice, and rejects invalid ids", async () => {
    const initial = state();
    initial.ecosystem.lifecycle.plots["1"].nextSeedId = "carrot-seed";
    const domain = new MemoryDomain(initial);
    const host = service(domain);
    const cancel = { ...request("claimDaily", 422), type: "cancelPlanting", plotId: "1" };
    const results = await Promise.all([host.command(cancel), host.command({ ...cancel, commandId: request("claimDaily", 423).commandId })]);
    expect(results.map(result => result.status)).toEqual([200, 409]);
    expect(results[1].errorCode).toBe("revision-conflict");
    expect(domain.persisted().ecosystem.supplies.fertilizer).toBe(2);
    for (const plotId of ["__proto__", "constructor", "0", "7"]) {
      expect(() => host.command({ ...cancel, plotId })).toThrow();
    }
    expect(domain.writeCount).toBe(1);
  });

  it("does not retain a refund when storage fails and safely retries the same command", async () => {
    const initial = state();
    initial.ecosystem.lifecycle.plots["1"].nextSeedId = "carrot-seed";
    initial.ecosystem.supplies.fertilizer = 998;
    const domain = new MemoryDomain(initial);
    domain.failNextWrite = true;
    const host = service(domain);
    const cancel = { ...request("claimDaily", 424), type: "cancelPlanting", plotId: "1" };
    await expect(host.command(cancel)).rejects.toThrow("storage unavailable");
    expect(domain.persisted()).toEqual(initial);
    expect(await host.command(cancel)).toMatchObject({ status: 200, snapshot: { ecosystem: { supplies: { fertilizer: 999 } } } });
    expect(domain.persisted().ecosystem.lifecycle.plots["1"].nextSeedId).toBeUndefined();
  });

  it("persists care, grants once across command replay and service restart", async () => {
    const domain = new MemoryDomain(state());
    const host = service(domain);
    const care = await host.command({ ...request("claimDaily", 401), type: "careHabitat", habitat: "aquarium" });
    expect(care.status).toBe(200);
    const claim = { ...request("claimDaily", 402, care.snapshot.revision), type: "claimJournal", questId: "daily-care" };
    const granted = await host.command(claim);
    expect(granted.status).toBe(200);
    expect(granted.snapshot.ecosystem.journal?.xp).toBe(10);
    expect(granted.snapshot.ecosystem.supplies.fishFeed).toBe(1);
    const replay = await service(domain).command(claim);
    expect(replay.snapshot.ecosystem.journal?.xp).toBe(10);
    const duplicate = await service(domain).command({ ...claim, ...request("claimDaily", 403, granted.snapshot.revision), type: "claimJournal", questId: "daily-care" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.errorCode).toBe("quest-unavailable");
    expect(domain.persisted().ecosystem.journal?.xp).toBe(10);
  });
  it("serializes competing sowing requests and rejects forged plot identifiers", async () => {
    const domain = new MemoryDomain(state());
    const host = service(domain);
    const base = { ...request("claimDaily", 410), type: "plantCrop", plotId: "2", seedId: "carrot-seed" };
    const results = await Promise.all([host.command(base), host.command({ ...base, commandId: request("claimDaily", 411).commandId })]);
    expect(results.map(result => result.status)).toEqual([200, 409]);
    expect(domain.persisted().ecosystem.supplies.fertilizer).toBe(0);
    expect(domain.persisted().ecosystem.lifecycle.plots["2"].seedId).toBe("carrot-seed");
    expect(() => host.command({ ...base, plotId: "__proto__" })).toThrow();
  });
  it("retains a beta 2 save and the new journal through schema round trips", () => {
    const old = state({ wallet: 25, inventory: ["plant"] });
    const migrated = hostStateSchema.parse(old);
    expect(migrated.wallet).toBe(25);
    expect(migrated.inventory).toEqual(["plant"]);
    expect(migrated.ecosystem.journal).toBeUndefined();
  });
});

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
    schemaVersion: 4,
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
    ecosystem: createInitialEcosystemState(),
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

function service(
  domain: MemoryDomain,
  clock = new FixedClock(NOW),
  rng: { next(): number } = { next: () => 0.7 },
): GameService {
  let nextId = 1;
  return new GameService(domain, {
    clock,
    rng,
    createId: () => `spin-${nextId++}`,
  });
}

function randomSequence(...values: number[]) {
  let index = 0;
  return { next: () => values[index++] ?? values.at(-1) ?? 0 };
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

function moveSessionHistoryTo(session: SessionLike, baseTime: Date): SessionLike {
  const firstTime = session.events[0]?.time ?? session.header.createdAt;
  const offset = baseTime.getTime() - firstTime;
  return {
    ...session,
    header: { ...session.header, createdAt: session.header.createdAt + offset },
    events: session.events.map((event) => ({ ...event, time: event.time + offset })),
  };
}

describe("authoritative game service", () => {
  it("persists the independent clock across polls and restart without changing the economy revision", async () => {
    const clock = new FixedClock(NOW);
    const seeded = createInitialEcosystemState();
    seeded.lifecycle.lastSimulatedAt = NOW.toISOString();
    const domain = new MemoryDomain(state({ ecosystem: seeded }));
    const game = service(domain, clock);

    const installed = await game.getSnapshot("session-1");
    expect(installed.ecosystem.world).toMatchObject({ elapsedMs: 0 });
    clock.set(new Date(NOW.getTime() + 12 * 60 * 1_000));
    const first = await game.getSnapshot("session-1");
    const second = await game.getSnapshot("session-1");

    expect(first.ecosystem.lifecycle.fish.goldfish?.growth).toBe(24);
    expect(second.ecosystem.lifecycle).toEqual(first.ecosystem.lifecycle);
    expect(first.revision).toBe(0);
    expect(domain.writeCount).toBe(2);
    expect(domain.persisted().ecosystem.lifecycle.fish.goldfish?.growth).toBe(24);
    expect(first.ecosystem.world?.elapsedMs).toBe(6 * 60 * 60 * 1_000);
    expect(await service(domain, clock).getSnapshot("session-1")).toEqual(first);
  });

  it("does not expose an unpersisted clock initialization after a storage failure", async () => {
    const domain = new MemoryDomain(state());
    const clock = new FixedClock(NOW);
    const game = service(domain, clock);
    domain.failNextWrite = true;
    await expect(game.getSnapshot("session-1")).rejects.toThrow("storage unavailable");
    expect(domain.persisted().ecosystem.world).toBeUndefined();
    clock.set(new Date(NOW.getTime() + 60_000));
    expect((await game.getSnapshot("session-1")).ecosystem.world?.elapsedMs).toBe(0);
  });

  it("keeps two-second projections smooth while checkpointing only once per thirty real seconds", async () => {
    const domain = new MemoryDomain(state());
    const clock = new FixedClock(NOW);
    const game = service(domain, clock);
    await game.getSnapshot("session-1");
    for (let index = 1; index <= 20; index += 1) {
      clock.set(new Date(NOW.getTime() + index * 2_000));
      const [first, second] = await Promise.all([
        game.getSnapshot("session-1"), game.getSnapshot("session-2"),
      ]);
      expect(first.ecosystem.world?.elapsedMs).toBe(index * 2_000 * 30);
      expect(second.ecosystem.world).toEqual(first.ecosystem.world);
      expect(first.revision).toBe(0);
    }
    expect(domain.writeCount).toBe(2);
    expect(domain.persisted().ecosystem.world?.elapsedMs).toBe(30_000 * 30);
    const restored = await service(domain, clock).getSnapshot("session-1");
    expect(restored.ecosystem.world?.elapsedMs).toBe(40_000 * 30);
    expect(domain.writeCount).toBe(2);
  });

  it("rejects a failed clock checkpoint and reconstructs its elapsed interval on retry", async () => {
    const domain = new MemoryDomain(state());
    const clock = new FixedClock(NOW);
    const game = service(domain, clock);
    await game.getSnapshot("session-1");
    clock.set(new Date(NOW.getTime() + 30_000));
    domain.failNextWrite = true;
    await expect(game.getSnapshot("session-1")).rejects.toThrow("storage unavailable");
    expect(domain.persisted().ecosystem.world?.elapsedMs).toBe(0);
    clock.set(new Date(NOW.getTime() + 32_000));
    expect((await game.getSnapshot("session-1")).ecosystem.world?.elapsedMs).toBe(32_000 * 30);
    expect(domain.persisted().ecosystem.world?.elapsedMs).toBe(32_000 * 30);
  });

  it("checkpoints a capped long absence immediately so repeated polls and restart cannot replay excess time", async () => {
    const domain = new MemoryDomain(state());
    const clock = new FixedClock(NOW);
    const game = service(domain, clock);
    await game.getSnapshot("session-1");
    const later = new Date(NOW.getTime() + 48 * 60 * 60_000);
    clock.set(later);
    const resumed = await game.getSnapshot("session-1");
    const cappedElapsed = 24 * 60 * 60_000 * 30;
    expect(resumed.ecosystem.world).toMatchObject({ elapsedMs: cappedElapsed, lastRealAt: later.toISOString() });
    expect(domain.writeCount).toBe(2);
    expect((await service(domain, clock).getSnapshot("session-1")).ecosystem.world).toEqual(resumed.ecosystem.world);
    clock.set(new Date(later.getTime() + 2_000));
    expect((await game.getSnapshot("session-1")).ecosystem.world?.elapsedMs).toBe(cappedElapsed + 60_000);
    expect(domain.writeCount).toBe(2);
    clock.set(new Date(later.getTime() - 1_000));
    expect((await game.getSnapshot("session-1")).ecosystem.world?.elapsedMs).toBe(cappedElapsed);
    expect(domain.writeCount).toBe(2);
  });

  it("keeps daily coin grants on real dates when multiple game days pass", async () => {
    const domain = new MemoryDomain(state());
    const clock = new FixedClock(NOW);
    const game = service(domain, clock);
    await game.command(request("claimDaily", 901));
    clock.set(new Date(NOW.getTime() + 96 * 60_000));
    const later = await game.getSnapshot("session-1");
    expect(later.ecosystem.world?.elapsedMs).toBe(48 * 60 * 60_000);
    const daily = await game.command({ ...request("claimDaily", 902, 1), issuedAt: clock.now().toISOString() });
    expect(daily.snapshot.wallet).toBe(3);
    expect(daily.snapshot.revision).toBe(1);
  });

  it("does not backfill token rewards from session history older than seven days", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const oldHistory = moveSessionHistoryTo(
      sessionHistory(13, 23),
      new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1_000),
    );

    await game.adoptSession(oldHistory);
    await game.completeUsageBootstrap();

    expect(domain.persisted()).toMatchObject({
      revision: 0,
      wallet: 0,
      tokenEnergy: { progress: 0, dailyCoins: {} },
      tokenUsageWatermarks: {},
    });
    expect(domain.writeCount).toBe(0);
  });

  it("accepts a new turn after an old session was skipped during bootstrap", async () => {
    const domain = new MemoryDomain(state());
    const game = service(domain);
    const oldHistory = moveSessionHistoryTo(
      sessionHistory(13),
      new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1_000),
    );

    await game.adoptSession(oldHistory);
    await game.completeUsageBootstrap();

    const currentHistory = sessionHistory(23);
    for (const event of currentHistory.events) {
      await game.acceptSessionEvent(currentHistory, event);
    }

    expect(domain.persisted()).toMatchObject({
      revision: 1,
      wallet: 0,
      tokenEnergy: { progress: 1_500 },
      tokenUsageWatermarks: { "session-1": 23 },
    });
  });

  it("settles elapsed time before care and collection, then receipts exactly one crop", async () => {
    const clock = new FixedClock(NOW);
    const domain = new MemoryDomain(state());
    const game = service(domain, clock);
    const base = { sessionId: "session-1" };

    const cared = await game.command({
      ...base,
      type: "careHabitat",
      habitat: "garden",
      commandId: "00000000-0000-4000-8000-000000000251",
      expectedRevision: 0,
      issuedAt: clock.now().toISOString(),
    });
    expect(cared).toMatchObject({ status: 200 });

    clock.set(new Date(NOW.getTime() + 24 * 60 * 60 * 1_000));
    const mature = await game.getSnapshot("session-1");
    expect(mature.ecosystem.lifecycle.plots["1"].readyYield).toBe(1);

    const collect = {
      ...base,
      type: "collectHabitat" as const,
      habitat: "garden" as const,
      commandId: "00000000-0000-4000-8000-000000000252",
      expectedRevision: 1,
      issuedAt: clock.now().toISOString(),
    };
    const first = await game.command(collect);
    const retry = await game.command({ ...collect, expectedRevision: 99 });
    expect(first).toMatchObject({
      status: 200,
      snapshot: {
        wallet: 3,
        ecosystem: { lifecycle: { produce: { carrot: 1 } } },
      },
    });
    expect(retry).toEqual(first);
    expect(domain.persisted()).toMatchObject({ wallet: 3 });

    expect(await game.command({
      ...collect,
      commandId: "00000000-0000-4000-8000-000000000253",
      expectedRevision: 2,
    })).toMatchObject({ status: 409, errorCode: "nothing-to-collect" });
  });

  it("uses the authoritative wallet for residents, supplies, and habitat care", async () => {
    const domain = new MemoryDomain(state({ wallet: 20 }));
    const game = service(domain);
    const base = {
      sessionId: "session-1",
      issuedAt: NOW.toISOString(),
    };

    const resident = await game.command({
      ...base,
      type: "buyItem",
      itemId: "clownfish",
      commandId: "00000000-0000-4000-8000-000000000201",
      expectedRevision: 0,
    });
    const supply = await game.command({
      ...base,
      type: "buyItem",
      itemId: "fish-feed",
      commandId: "00000000-0000-4000-8000-000000000202",
      expectedRevision: 1,
    });
    const care = await game.command({
      ...base,
      type: "careHabitat",
      habitat: "aquarium",
      commandId: "00000000-0000-4000-8000-000000000203",
      expectedRevision: 2,
    });

    expect(resident.status).toBe(200);
    expect(supply.status).toBe(200);
    expect(care.status).toBe(200);
    expect(domain.persisted()).toMatchObject({
      wallet: 6,
      ecosystem: {
        discovered: expect.arrayContaining(["clownfish"]),
        selected: { aquarium: "clownfish" },
        supplies: { fishFeed: 1 },
        progress: { aquarium: 0 },
        lifecycle: {
          fish: { clownfish: { growth: 0, boostedUntil: "2000-01-01T12:00:00.000Z" } },
        },
      },
    });
  });
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
      schemaVersion: 4,
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

  it("runs a real consumable spin through Host payment, lever, settlement, and pity", async () => {
    const domain = new MemoryDomain(state({ wallet: 2, pityCount: 9 }));
    const game = service(domain, new FixedClock(NOW), randomSequence(0.8, 0.99));

    let result = await game.command(request("insertCoin", 701));
    expect(result).toMatchObject({
      status: 200,
      snapshot: {
        wallet: 1,
        pityCount: 9,
        pendingSpin: {
          id: "spin-1",
          stage: "paid",
          reward: {
            kind: "ecosystem-item",
            itemId: "animal-feed",
            isDuplicate: false,
          },
          pityAfter: 10,
        },
      },
    });

    result = await game.command({
      ...request("insertCoin", 702, 1),
      type: "pullLever",
      spinId: "spin-1",
    });
    expect(result).toMatchObject({ status: 200, snapshot: { pendingSpin: { stage: "spinning" } } });

    result = await game.command({
      ...request("insertCoin", 703, 2),
      type: "settleSpin",
      spinId: "spin-1",
    });
    expect(result).toMatchObject({
      status: 200,
      snapshot: {
        wallet: 1,
        pityCount: 10,
        pendingSpin: null,
        ecosystem: { supplies: { animalFeed: 2 } },
      },
    });
    expect(domain.persisted()).toMatchObject({
      revision: 3,
      wallet: 1,
      pityCount: 10,
      pendingSpin: null,
      ecosystem: { supplies: { animalFeed: 2 } },
    });
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
