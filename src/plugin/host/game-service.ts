import { createInitialState, type GameState } from "../../domain/types";
import { legacyPlacements } from "../../domain/table-positions";
import { createPaidSpin } from "../../game/outcomes";
import type { RandomSource } from "../../game/rng";
import { mathRandomSource } from "../../game/rng";
import {
  buyCollectible,
  settleActiveSpin,
  setCollectibleDisplayed,
  setCollectiblePlacement,
} from "../../inventory/inventory";
import {
  buyEcosystemItem,
  careForHabitat,
  collectHabitatProduce,
} from "../../ecosystem/ecosystem";
import { advanceEcosystemTo } from "../../ecosystem/lifecycle";
import type { Clock } from "../../time/clock";
import { localDateKey, SystemClock } from "../../time/clock";
import type {
  CommandErrorCode,
  CommandRequest,
  CommandResult,
  EligibleTurnUsage,
  HostState,
  PublicSnapshot,
} from "../shared/contracts";
import { commandRequestSchema, hostStateSchema } from "../shared/contracts";
import type { GameDomain } from "./domain";
import { SerialQueue } from "./serial-queue";
import {
  SessionUsageCollector,
  type SessionEventLike,
  type SessionLike,
} from "./session-usage";
import { applyEligibleTurnUsage } from "./token-energy";

const COMMAND_MAX_AGE_MS = 15 * 60 * 1_000;
const COMMAND_FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;
const MAX_RECENT_COMMANDS = 128;
const USAGE_REWARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export interface GameServiceDependencies {
  readonly clock: Clock;
  readonly rng: RandomSource;
  readonly createId: () => string;
}

const DEFAULT_DEPENDENCIES: GameServiceDependencies = {
  clock: new SystemClock(),
  rng: mathRandomSource,
  createId: () => crypto.randomUUID(),
};

type Transition =
  | { readonly kind: "changed"; readonly state: HostState }
  | { readonly kind: "unchanged" }
  | { readonly kind: "error"; readonly code: CommandErrorCode };

interface BufferedSessionEvent {
  readonly session: SessionLike;
  readonly event: SessionEventLike;
}

export class GameService {
  private readonly queue = new SerialQueue();
  private readonly usage = new SessionUsageCollector();
  private readonly activeAgents = new Map<string, Set<string>>();
  private readonly blockedUsageSessions = new Set<string>();
  private readonly bufferedSessionEvents: BufferedSessionEvent[] = [];
  private readonly usageEventHighWatermarks = new Map<string, number>();
  private readonly adoptedUsageSessions = new Set<string>();
  private readonly usageAdoptions = new Map<string, Promise<void>>();
  private readonly dependencies: GameServiceDependencies;
  private usageBootstrapComplete = false;
  private usageBootstrapCompletion: Promise<void> | null = null;
  private active = true;
  private disposal: Promise<void> | null = null;

  constructor(
    private readonly domain: GameDomain,
    dependencies: Partial<GameServiceDependencies> = {},
  ) {
    this.dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  }

  getSnapshot(sessionId: string): Promise<PublicSnapshot> {
    this.ensureActive();
    return this.queue.run(() => this.project(this.read(), sessionId));
  }

  command(input: unknown): Promise<CommandResult> {
    this.ensureActive();
    const request = commandRequestSchema.parse(input);
    return this.queue.run(async () => {
      const now = this.dependencies.clock.now();
      const storedCurrent = this.read();
      const current: HostState = {
        ...storedCurrent,
        ecosystem: advanceEcosystemTo(storedCurrent.ecosystem, now),
      };
      const today = localDateKey(now);
      const fingerprint = commandFingerprint(request);
      const receipt = current.recentCommands[request.commandId];

      if (receipt !== undefined) {
        return receipt.fingerprint === fingerprint
          ? {
              status: 200,
              snapshot: this.withCurrentAgentStatus(receipt.snapshot, request.sessionId),
            }
          : this.conflict(current, request.sessionId, "command-id-reused");
      }

      if (request.expectedRevision !== current.revision) {
        return this.conflict(current, request.sessionId, "revision-conflict");
      }
      if (isExpired(request.issuedAt, now)) {
        return this.conflict(current, request.sessionId, "command-expired");
      }

      const transition = this.transition(current, request, today, now);
      if (transition.kind === "error") {
        return this.conflict(current, request.sessionId, transition.code);
      }
      if (transition.kind === "unchanged") {
        const snapshot = this.project(current, request.sessionId);
        await this.domain.global.set({
          ...current,
          recentCommands: appendReceipt(
            current.recentCommands,
            request,
            fingerprint,
            snapshot,
          ),
        });
        return { status: 200, snapshot };
      }

      const changed = { ...transition.state, revision: current.revision + 1 };
      const snapshot = this.project(changed, request.sessionId);
      const next: HostState = {
        ...changed,
        recentCommands: appendReceipt(current.recentCommands, request, fingerprint, snapshot),
      };
      await this.domain.global.set(next);
      return { status: 200, snapshot };
    });
  }

  acceptUsage(event: EligibleTurnUsage): Promise<void> {
    this.ensureActive();
    return this.queue.run(() => this.processUsage(event));
  }

  acceptSessionEvent(session: SessionLike, event: SessionEventLike): Promise<void> {
    this.ensureActive();
    if (!this.usageBootstrapComplete) {
      // Buffer raw events until the authoritative session-prefix scan is
      // adopted. Aggregates alone cannot continue a turn that was open when
      // the listener mounted.
      this.bufferedSessionEvents.push({ session, event });
      return Promise.resolve();
    }
    if (this.adoptedUsageSessions.has(session.id)) {
      return this.acceptAdoptedSessionEvent(session, event);
    }
    return this.adoptSession(session)
      .then(() => this.acceptAdoptedSessionEvent(session, event));
  }

  adoptSession(session: SessionLike): Promise<void> {
    this.ensureActive();
    if (this.adoptedUsageSessions.has(session.id)) return Promise.resolve();
    const existing = this.usageAdoptions.get(session.id);
    if (existing !== undefined) return existing;

    const current = this.read();
    if (
      !requiresLegacyUsageRecovery(current, session.id) &&
      isSessionHistoryExpired(session, this.dependencies.clock.now())
    ) {
      this.recordUsageHighWater(session);
      this.adoptedUsageSessions.add(session.id);
      return Promise.resolve();
    }

    // session.events is an authoritative complete prefix/high-water. The same
    // collector continues any open turn with buffered/live suffix events.
    const aggregates = this.adoptUsagePrefix(session);
    const adoption = this.queue.run(() => this.processSessionHistory(session.id, aggregates))
      .then(
        () => {
          this.adoptedUsageSessions.add(session.id);
          this.usageAdoptions.delete(session.id);
        },
        (error: unknown) => {
          this.usageAdoptions.delete(session.id);
          throw error;
        },
      );
    this.usageAdoptions.set(session.id, adoption);
    return adoption;
  }

  completeUsageBootstrap(): Promise<void> {
    this.ensureActive();
    if (this.usageBootstrapComplete) return this.queue.drain();
    if (this.usageBootstrapCompletion !== null) return this.usageBootstrapCompletion;

    this.usageBootstrapCompletion = this.queue.run(async () => {
      // Events may arrive during storage awaits. Drain until empty, then flip
      // the phase synchronously so no append can fall between scan and live.
      while (this.bufferedSessionEvents.length > 0) {
        const buffered = this.bufferedSessionEvents.splice(0).sort(compareSessionEvents);
        const missedSnapshots = latestSnapshotsBySession(buffered, this.adoptedUsageSessions);

        for (const [sessionId, session] of missedSnapshots) {
          const aggregates = this.adoptUsagePrefix(session);
          await this.processSessionHistory(sessionId, aggregates);
          this.adoptedUsageSessions.add(sessionId);
        }

        for (const entry of buffered) {
          const aggregate = this.collectSessionEvent(entry.session, entry.event);
          if (aggregate !== null) await this.processUsage(aggregate);
        }
      }
      this.usageBootstrapComplete = true;
    });
    return this.usageBootstrapCompletion;
  }

  acceptAgentStatus(
    sessionId: string,
    agentId: string,
    status: "idle" | "running",
  ): void {
    if (!this.active) return;
    const active = this.activeAgents.get(sessionId) ?? new Set<string>();
    if (status === "running") active.add(agentId);
    else active.delete(agentId);

    if (active.size === 0) this.activeAgents.delete(sessionId);
    else this.activeAgents.set(sessionId, active);
  }

  dispose(): Promise<void> {
    if (this.disposal !== null) return this.disposal;
    this.active = false;
    this.activeAgents.clear();
    this.blockedUsageSessions.clear();
    this.bufferedSessionEvents.splice(0);
    this.usageEventHighWatermarks.clear();
    this.adoptedUsageSessions.clear();
    this.usageAdoptions.clear();
    this.usage.clear();
    this.disposal = this.queue.drain();
    return this.disposal;
  }

  private read(): HostState {
    return hostStateSchema.parse(this.domain.global.get());
  }

  private async processUsage(event: EligibleTurnUsage): Promise<void> {
    if (this.blockedUsageSessions.has(event.sessionId)) return;
    const storedCurrent = this.read();
    const now = this.dependencies.clock.now();
    const current: HostState = {
      ...storedCurrent,
      ecosystem: advanceEcosystemTo(storedCurrent.ecosystem, now),
    };
    if (
      !requiresLegacyUsageRecovery(current, event.sessionId) &&
      isUsageExpired(event.occurredAt, now)
    ) return;
    const eventDate = localDateKey(event.occurredAt);
    const next = applyEligibleTurnUsage(current, event, eventDate);
    if (next === current) return;
    try {
      await this.domain.global.set(next);
    } catch (error) {
      // A later watermark must never jump over an uncommitted lower sequence.
      // Restart + ordered history adoption is the recovery boundary.
      this.blockedUsageSessions.add(event.sessionId);
      throw error;
    }
  }

  private async processSessionHistory(
    sessionId: string,
    aggregates: readonly EligibleTurnUsage[],
  ): Promise<void> {
    if (this.blockedUsageSessions.has(sessionId)) {
      throw new Error(`Token usage for ${sessionId} is blocked until Host restart`);
    }

    const storedCurrent = this.read();
    const current: HostState = {
      ...storedCurrent,
      ecosystem: advanceEcosystemTo(storedCurrent.ecosystem, this.dependencies.clock.now()),
    };
    let next = current;
    const replayLegacyHistory = requiresLegacyUsageRecovery(current, sessionId);
    const now = this.dependencies.clock.now();
    for (const aggregate of aggregates) {
      if (!replayLegacyHistory && isUsageExpired(aggregate.occurredAt, now)) continue;
      next = applyEligibleTurnUsage(next, aggregate, localDateKey(aggregate.occurredAt));
    }
    next = pruneLegacyReceiptsForSession(next, sessionId);
    if (next === current) return;

    try {
      await this.domain.global.set(next);
    } catch (error) {
      this.blockedUsageSessions.add(sessionId);
      throw error;
    }
  }

  private adoptUsagePrefix(session: SessionLike): readonly EligibleTurnUsage[] {
    this.recordUsageHighWater(session);
    return this.usage.adopt(session);
  }

  private recordUsageHighWater(session: SessionLike): void {
    const highWater = sessionHighWater(session);
    this.usageEventHighWatermarks.set(
      session.id,
      Math.max(this.usageEventHighWatermarks.get(session.id) ?? -1, highWater),
    );
  }

  private acceptAdoptedSessionEvent(
    session: SessionLike,
    event: SessionEventLike,
  ): Promise<void> {
    const aggregate = this.collectSessionEvent(session, event);
    return aggregate === null ? Promise.resolve() : this.acceptUsage(aggregate);
  }

  private collectSessionEvent(
    session: SessionLike,
    event: SessionEventLike,
  ): EligibleTurnUsage | null {
    const eventSeq = Number.isSafeInteger(event.seq) && event.seq >= 0
      ? event.seq
      : null;
    const highWater = this.usageEventHighWatermarks.get(session.id) ?? -1;
    if (eventSeq !== null && eventSeq <= highWater) return null;

    const aggregate = this.usage.accept(session, event);
    if (eventSeq !== null) this.usageEventHighWatermarks.set(session.id, eventSeq);
    return aggregate;
  }

  private ensureActive(): void {
    if (!this.active) throw new Error("dsh-slot-widget host service is disposed");
  }

  private project(state: HostState, sessionId: string): PublicSnapshot {
    const ecosystem = advanceEcosystemTo(state.ecosystem, this.dependencies.clock.now());
    return {
      revision: state.revision,
      wallet: state.wallet,
      localDate: localDateKey(this.dependencies.clock.now()),
      lastGrantedLocalDate: state.lastGrantedLocalDate,
      daily: structuredClone(state.daily),
      tokenEnergy: structuredClone(state.tokenEnergy),
      pityCount: state.pityCount,
      inventory: [...state.inventory],
      displaySlots: [...state.displaySlots],
      tablePlacements: placementsFor(state),
      ecosystem,
      settings: { ...state.settings },
      pendingSpin: state.pendingSpin === null ? null : structuredClone(state.pendingSpin),
      agentStatus: this.agentStatus(sessionId),
      capabilities: { commands: true },
    };
  }

  private withCurrentAgentStatus(
    snapshot: Omit<PublicSnapshot, "agentStatus">,
    sessionId: string,
  ): PublicSnapshot {
    return { ...structuredClone(snapshot), agentStatus: this.agentStatus(sessionId) };
  }

  private agentStatus(sessionId: string): PublicSnapshot["agentStatus"] {
    return (this.activeAgents.get(sessionId)?.size ?? 0) > 0 ? "working" : "idle";
  }

  private conflict(
    state: HostState,
    sessionId: string,
    errorCode: CommandErrorCode,
  ): CommandResult {
    return { status: 409, snapshot: this.project(state, sessionId), errorCode };
  }

  private transition(
    current: HostState,
    request: CommandRequest,
    today: string,
    now: Date,
  ): Transition {
    switch (request.type) {
      case "claimDaily":
        if (current.lastGrantedLocalDate !== null && today < current.lastGrantedLocalDate) {
          return { kind: "error", code: "clock-skew" };
        }
        if (current.lastGrantedLocalDate === today) return { kind: "unchanged" };
        return {
          kind: "changed",
          state: {
            ...current,
            wallet: current.wallet + 3,
            lastGrantedLocalDate: today,
          },
        };

      case "insertCoin": {
        const result = createPaidSpin(
          toGameState(current),
          this.dependencies.rng,
          this.dependencies.clock.now(),
          this.dependencies.createId,
        );
        if (!result.ok) {
          return {
            kind: "error",
            code: result.reason === "INSUFFICIENT_COINS"
              ? "insufficient-coins"
              : "invalid-spin-state",
          };
        }
        const spin = result.spin;
        return {
          kind: "changed",
          state: {
            ...current,
            wallet: result.state.wallet,
            pendingSpin: {
              id: spin.id,
              stage: "paid",
              reels: [...spin.reels],
              reward: spin.reward,
              pityAfter: spin.pityAfter,
              createdAt: spin.createdAt,
            },
          },
        };
      }

      case "pullLever": {
        const spin = current.pendingSpin;
        if (spin === null || spin.id !== request.spinId || spin.stage !== "paid") {
          return { kind: "error", code: "invalid-spin-state" };
        }
        return {
          kind: "changed",
          state: { ...current, pendingSpin: { ...spin, stage: "spinning" } },
        };
      }

      case "settleSpin": {
        const spin = current.pendingSpin;
        if (spin === null || spin.id !== request.spinId || spin.stage !== "spinning") {
          return { kind: "error", code: "invalid-spin-state" };
        }
        const game = toGameState(current);
        game.activeSpin = { ...game.activeSpin!, stage: "payout" };
        const settled = settleActiveSpin(game, spin.id);
        return {
          kind: "changed",
          state: {
            ...current,
            wallet: settled.wallet,
            pityCount: settled.pityMisses,
            inventory: settled.ownedCollectibles,
            displaySlots: settled.displayedCollectibles,
            tablePlacements: settled.tablePlacements,
            ecosystem: settled.ecosystem,
            pendingSpin: null,
          },
        };
      }

      case "buyItem": {
        const collectibleResult = buyCollectible(toGameState(current), request.itemId);
        const result = collectibleResult.ok || collectibleResult.reason !== "UNKNOWN_ITEM"
          ? collectibleResult
          : buyEcosystemItem(toGameState(current), request.itemId);
        if (!result.ok) return { kind: "error", code: purchaseError(result.reason) };
        return {
          kind: "changed",
          state: {
            ...current,
            wallet: result.state.wallet,
            inventory: result.state.ownedCollectibles,
            displaySlots: result.state.displayedCollectibles,
            tablePlacements: result.state.tablePlacements,
            ecosystem: result.state.ecosystem,
          },
        };
      }

      case "careHabitat": {
        const result = careForHabitat(toGameState(current), request.habitat, now);
        if (!result.ok) return { kind: "error", code: "no-supply" };
        return {
          kind: "changed",
          state: {
            ...current,
            wallet: result.state.wallet,
            ecosystem: result.state.ecosystem,
          },
        };
      }

      case "collectHabitat": {
        const result = collectHabitatProduce(toGameState(current), request.habitat, now);
        if (!result.ok) return { kind: "error", code: "nothing-to-collect" };
        return {
          kind: "changed",
          state: {
            ...current,
            wallet: result.state.wallet,
            ecosystem: result.state.ecosystem,
          },
        };
      }

      case "setDisplay": {
        if (!current.inventory.includes(request.itemId)) {
          return { kind: "error", code: "item-not-owned" };
        }
        const result = setCollectibleDisplayed(
          toGameState(current),
          request.itemId,
          request.displayed,
        );
        if (sameStrings(result.displayedCollectibles, current.displaySlots)) {
          return { kind: "unchanged" };
        }
        return {
          kind: "changed",
          state: {
            ...current,
            displaySlots: result.displayedCollectibles,
            tablePlacements: result.tablePlacements,
          },
        };
      }

      case "setPlacement": {
        if (!current.inventory.includes(request.itemId)) {
          return { kind: "error", code: "item-not-owned" };
        }
        const placements = placementsFor(current);
        const game = toGameState(current);
        const result = setCollectiblePlacement(game, request.itemId, request.positionId);
        if (samePlacements(result.tablePlacements, placements)) return { kind: "unchanged" };
        return {
          kind: "changed",
          state: {
            ...current,
            displaySlots: result.displayedCollectibles,
            tablePlacements: result.tablePlacements,
          },
        };
      }

      case "updateSettings": {
        const settings = { ...current.settings, ...request.patch };
        if (
          settings.muted === current.settings.muted &&
          settings.reducedMotion === current.settings.reducedMotion &&
          settings.scale === current.settings.scale &&
          settings.companionScale === current.settings.companionScale
        ) {
          return { kind: "unchanged" };
        }
        return { kind: "changed", state: { ...current, settings } };
      }
    }
  }
}

function toGameState(state: HostState): GameState {
  const game = createInitialState();
  game.revision = state.revision;
  game.wallet = state.wallet;
  game.lastAwardDate = state.lastGrantedLocalDate as GameState["lastAwardDate"];
  game.dailyLedgers = Object.fromEntries(Object.entries(state.daily).map(([date, ledger]) => [
    date,
    { workCoins: ledger.workCoins, focusMinutes: 0, settledFocusHours: 0, focusCoins: 0 },
  ]));
  game.pityMisses = state.pityCount;
  game.ownedCollectibles = [...state.inventory];
  game.displayedCollectibles = [...state.displaySlots];
  game.tablePlacements = placementsFor(state);
  game.ecosystem = structuredClone(state.ecosystem);
  game.settings = { ...state.settings };
  game.activeSpin = state.pendingSpin === null
    ? null
    : {
        ...structuredClone(state.pendingSpin),
        stage: state.pendingSpin.stage === "paid" ? "coin-inserted" : "spinning",
      };
  return game;
}

function purchaseError(reason: "UNKNOWN_ITEM" | "ALREADY_OWNED" | "INSUFFICIENT_COINS" | "LOCKED_SPIN_REWARD"): CommandErrorCode {
  switch (reason) {
    case "UNKNOWN_ITEM": return "unknown-item";
    case "ALREADY_OWNED": return "already-owned";
    case "INSUFFICIENT_COINS": return "insufficient-coins";
    case "LOCKED_SPIN_REWARD": return "locked-spin-reward";
  }
}

function commandFingerprint(request: CommandRequest): string {
  switch (request.type) {
    case "claimDaily":
    case "insertCoin":
      return JSON.stringify([request.sessionId, request.type]);
    case "pullLever":
    case "settleSpin":
      return JSON.stringify([request.sessionId, request.type, request.spinId]);
    case "buyItem":
      return JSON.stringify([request.sessionId, request.type, request.itemId]);
    case "careHabitat":
      return JSON.stringify([request.sessionId, request.type, request.habitat]);
    case "collectHabitat":
      return JSON.stringify([request.sessionId, request.type, request.habitat]);
    case "setDisplay":
      return JSON.stringify([request.sessionId, request.type, request.itemId, request.displayed]);
    case "setPlacement":
      return JSON.stringify([request.sessionId, request.type, request.itemId, request.positionId]);
    case "updateSettings":
      return JSON.stringify([
        request.sessionId,
        request.type,
        request.patch.muted ?? null,
        request.patch.reducedMotion ?? null,
        request.patch.scale ?? null,
        request.patch.companionScale ?? null,
      ]);
  }
}

function placementsFor(state: Pick<HostState, "displaySlots" | "tablePlacements">) {
  const source = state.tablePlacements?.length ? state.tablePlacements : legacyPlacements(state.displaySlots);
  return source.map((placement) => ({ ...placement }));
}

function samePlacements(
  left: readonly { itemId: string; positionId: string }[],
  right: readonly { itemId: string; positionId: string }[],
): boolean {
  return left.length === right.length && left.every((placement, index) => (
    placement.itemId === right[index]?.itemId && placement.positionId === right[index]?.positionId
  ));
}

function appendReceipt(
  receipts: HostState["recentCommands"],
  request: CommandRequest,
  fingerprint: string,
  snapshot: PublicSnapshot,
): HostState["recentCommands"] {
  const retained = Object.entries(receipts)
    .sort((left, right) => left[1].issuedAt.localeCompare(right[1].issuedAt))
    .slice(-(MAX_RECENT_COMMANDS - 1));
  const { agentStatus: _volatileAgentStatus, ...durableSnapshot } = snapshot;
  return {
    ...Object.fromEntries(retained),
    [request.commandId]: {
      fingerprint,
      issuedAt: request.issuedAt,
      snapshot: durableSnapshot,
    },
  };
}

function isExpired(issuedAt: string, now: Date): boolean {
  const age = now.getTime() - new Date(issuedAt).getTime();
  return age > COMMAND_MAX_AGE_MS || age < -COMMAND_FUTURE_TOLERANCE_MS;
}

function isUsageExpired(occurredAt: string, now: Date): boolean {
  return now.getTime() - new Date(occurredAt).getTime() > USAGE_REWARD_WINDOW_MS;
}

function isSessionHistoryExpired(session: SessionLike, now: Date): boolean {
  const latestEventTime = session.events.reduce(
    (latest, event) => Number.isFinite(event.time) ? Math.max(latest, event.time) : latest,
    session.header.createdAt,
  );
  return now.getTime() - latestEventTime > USAGE_REWARD_WINDOW_MS;
}

function requiresLegacyUsageRecovery(state: HostState, sessionId: string): boolean {
  return state.legacyTokenUsageReceipts?.[sessionId] !== undefined ||
    state.legacyWeightedUsageWatermarks?.[sessionId] !== undefined;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compareSessionEvents(left: BufferedSessionEvent, right: BufferedSessionEvent): number {
  return left.session.id.localeCompare(right.session.id) || left.event.seq - right.event.seq;
}

function latestSnapshotsBySession(
  buffered: readonly BufferedSessionEvent[],
  adopted: ReadonlySet<string>,
): Map<string, SessionLike> {
  const latest = new Map<string, SessionLike>();
  for (const entry of buffered) {
    if (adopted.has(entry.session.id)) continue;
    const current = latest.get(entry.session.id);
    if (current === undefined || sessionHighWater(entry.session) > sessionHighWater(current)) {
      latest.set(entry.session.id, entry.session);
    }
  }
  return latest;
}

function sessionHighWater(session: SessionLike): number {
  return session.events.reduce(
    (highest, event) => Number.isSafeInteger(event.seq) && event.seq >= 0
      ? Math.max(highest, event.seq)
      : highest,
    -1,
  );
}

function pruneLegacyReceiptsForSession(state: HostState, sessionId: string): HostState {
  const legacy = state.legacyTokenUsageReceipts;
  if (legacy?.[sessionId] === undefined) return state;
  const { [sessionId]: _removedSession, ...retained } = legacy;

  const { legacyTokenUsageReceipts: _removed, ...migrated } = state;
  return Object.keys(retained).length === 0
    ? migrated
    : { ...migrated, legacyTokenUsageReceipts: retained };
}
