import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimationBoundaryEvent } from "../../components/GameCanvas";
import { createInitialState, type GameSettings, type GameState, type HabitatId, type ResolvedSpin, type TablePositionId } from "../../domain/types";
import type { CommandRequest, CommandResult, PublicSnapshot } from "../shared/contracts";
import type { GameApi } from "./api";

const POLL_INTERVAL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
type CommandPayload =
  | { type: "claimDaily" | "insertCoin" }
  | { type: "pullLever" | "settleSpin"; spinId: string }
  | { type: "buyItem"; itemId: string }
  | { type: "careHabitat"; habitat: HabitatId }
  | { type: "collectHabitat"; habitat: Extract<HabitatId, "garden" | "animals"> }
  | { type: "setDisplay"; itemId: string; displayed: boolean }
  | { type: "setPlacement"; itemId: string; positionId: TablePositionId | null }
  | { type: "updateSettings"; patch: Partial<GameSettings> };

export interface HostGameControllerOptions {
  api: GameApi;
  sessionId: string;
  createCommandId?: () => string;
  now?: () => Date;
  requestTimeoutMs?: number;
}

export interface HostGameController {
  snapshot: PublicSnapshot | null;
  gameState: GameState;
  offline: boolean;
  mutationsDisabled: boolean;
  error: string | null;
  refresh(): Promise<void>;
  insertCoin(): Promise<void>;
  pullLever(): Promise<void>;
  play(): Promise<void>;
  buy(itemId: string): Promise<void>;
  care(habitat: HabitatId): Promise<void>;
  collect(habitat: Extract<HabitatId, "garden" | "animals">): Promise<void>;
  setDisplayed(itemId: string, displayed: boolean): Promise<void>;
  setPlacement(itemId: string, positionId: TablePositionId | null): Promise<void>;
  setSettings(patch: Partial<GameSettings>): Promise<void>;
  advanceAnimation(event: AnimationBoundaryEvent): Promise<void>;
}

export function useHostGameController({
  api,
  sessionId,
  createCommandId = defaultCommandId,
  now = defaultNow,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: HostGameControllerOptions): HostGameController {
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [visualSpin, setVisualSpin] = useState<ResolvedSpin | null>(null);
  const [offline, setOffline] = useState(false);
  const [commandPending, setCommandPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const visualSpinRef = useRef(visualSpin);
  const uncertainSettlementRef = useRef<ResolvedSpin | null>(null);
  const commandPendingRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(false);
  const controllersRef = useRef(new Set<AbortController>());
  const effectiveRequestTimeoutMs = normalizeRequestTimeout(requestTimeoutMs);

  snapshotRef.current = snapshot;
  visualSpinRef.current = visualSpin;

  const adoptSnapshot = useCallback((next: PublicSnapshot): boolean => {
    if (snapshotRef.current !== null && next.revision < snapshotRef.current.revision) return false;
    if (
      snapshotRef.current !== null &&
      next.revision === snapshotRef.current.revision &&
      ecosystemTimestamp(next) < ecosystemTimestamp(snapshotRef.current)
    ) return false;
    snapshotRef.current = next;
    setSnapshot(next);
    setOffline(false);
    const current = visualSpinRef.current;
    const uncertain = uncertainSettlementRef.current;
    const hostSpin = next.pendingSpin;
    let projected: ResolvedSpin | null;
    if (hostSpin === null) {
      uncertainSettlementRef.current = null;
      projected = current?.stage === "settled"
        ? current
        : uncertain === null
          ? null
          : { ...uncertain, stage: "settled" } as ResolvedSpin;
    } else {
      uncertainSettlementRef.current = null;
      let stage: ResolvedSpin["stage"];
      if (hostSpin.stage === "paid") {
        stage = "coin-inserted";
      } else if (uncertain?.id === hostSpin.id) {
        stage = "spinning";
      } else if (
        current?.id === hostSpin.id &&
        (current.stage === "highlight" || current.stage === "payout")
      ) {
        stage = current.stage;
      } else {
        stage = "spinning";
      }
      projected = { ...hostSpin, stage } as ResolvedSpin;
    }
    updateVisualSpin(setVisualSpin, visualSpinRef, projected);
    return true;
  }, []);

  const executeCommand = useCallback(async (
    payload: CommandPayload,
    baseSnapshot = snapshotRef.current,
  ): Promise<CommandResult | null> => {
    if (
      baseSnapshot === null ||
      !baseSnapshot.capabilities.commands ||
      commandPendingRef.current
    ) return null;

    commandPendingRef.current = true;
    setCommandPending(true);
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      const request = makeCommandRequest(
        payload,
        sessionId,
        baseSnapshot.revision,
        createCommandId(),
        now().toISOString(),
      );
      const result = await awaitHostRequest(
        controller,
        effectiveRequestTimeoutMs,
        "command",
        () => api.command(request, controller.signal),
      );
      if (!mountedRef.current) return result;
      adoptSnapshot(result.snapshot);
      setError(result.status === 409 ? result.errorCode : null);
      return result;
    } catch (cause) {
      if (mountedRef.current && shouldReportFailure(cause, controller.signal)) {
        setOffline(true);
        setError(messageFor(cause));
      }
      return null;
    } finally {
      controllersRef.current.delete(controller);
      commandPendingRef.current = false;
      if (mountedRef.current) setCommandPending(false);
    }
  }, [adoptSnapshot, api, createCommandId, effectiveRequestTimeoutMs, now, sessionId]);

  const refresh = useCallback((): Promise<void> => {
    const activeRefresh = refreshInFlightRef.current;
    if (activeRefresh !== null) return activeRefresh;

    const controller = new AbortController();
    controllersRef.current.add(controller);
    const task = (async (): Promise<void> => {
      try {
        const next = await awaitHostRequest(
          controller,
          effectiveRequestTimeoutMs,
          "refresh",
          () => api.getSnapshot(sessionId, controller.signal),
        );
        if (!mountedRef.current) return;
        if (!adoptSnapshot(next)) return;
        setError(null);
        if (shouldClaimDaily(next)) {
          await executeCommand({ type: "claimDaily" }, next);
        }
      } catch (cause) {
        if (mountedRef.current && shouldReportFailure(cause, controller.signal)) {
          setOffline(true);
          setError(messageFor(cause));
        }
      } finally {
        controllersRef.current.delete(controller);
      }
    })();
    refreshInFlightRef.current = task;
    void task.then(() => {
      if (refreshInFlightRef.current === task) {
        refreshInFlightRef.current = null;
      }
    });
    return task;
  }, [adoptSnapshot, api, effectiveRequestTimeoutMs, executeCommand, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = globalThis.setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    const refreshOnSignal = (): void => { void refresh(); };
    const refreshIfVisible = (): void => {
      if (document.visibilityState === "visible") void refresh();
    };
    globalThis.addEventListener("focus", refreshOnSignal);
    globalThis.addEventListener("online", refreshOnSignal);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      mountedRef.current = false;
      globalThis.clearInterval(interval);
      globalThis.removeEventListener("focus", refreshOnSignal);
      globalThis.removeEventListener("online", refreshOnSignal);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      for (const controller of controllersRef.current) controller.abort();
      controllersRef.current.clear();
    };
  }, [refresh]);

  const insertCoin = useCallback(async (): Promise<void> => {
    await executeCommand({ type: "insertCoin" });
  }, [executeCommand]);

  const pullLever = useCallback(async (): Promise<void> => {
    const spin = visualSpinRef.current;
    if (spin?.stage !== "coin-inserted") return;
    await executeCommand({ type: "pullLever", spinId: spin.id });
  }, [executeCommand]);

  const play = useCallback(async (): Promise<void> => {
    const spin = visualSpinRef.current;
    if (spin?.stage === "coin-inserted") {
      await executeCommand({ type: "pullLever", spinId: spin.id });
      return;
    }
    if (spin !== null) return;
    const inserted = await executeCommand({ type: "insertCoin" });
    if (inserted === null || inserted.status !== 200) return;
    const paid = inserted.snapshot.pendingSpin;
    if (paid?.stage !== "paid") return;
    await executeCommand({ type: "pullLever", spinId: paid.id }, inserted.snapshot);
  }, [executeCommand]);

  const buy = useCallback(async (itemId: string): Promise<void> => {
    await executeCommand({ type: "buyItem", itemId });
  }, [executeCommand]);

  const care = useCallback(async (habitat: HabitatId): Promise<void> => {
    await executeCommand({ type: "careHabitat", habitat });
  }, [executeCommand]);

  const collect = useCallback(async (
    habitat: Extract<HabitatId, "garden" | "animals">,
  ): Promise<void> => {
    await executeCommand({ type: "collectHabitat", habitat });
  }, [executeCommand]);

  const setDisplayed = useCallback(async (itemId: string, displayed: boolean): Promise<void> => {
    await executeCommand({ type: "setDisplay", itemId, displayed });
  }, [executeCommand]);

  const setPlacement = useCallback(async (
    itemId: string,
    positionId: TablePositionId | null,
  ): Promise<void> => {
    await executeCommand({ type: "setPlacement", itemId, positionId });
  }, [executeCommand]);

  const setSettings = useCallback(async (patch: Partial<GameSettings>): Promise<void> => {
    await executeCommand({ type: "updateSettings", patch });
  }, [executeCommand]);

  const advanceAnimation = useCallback(async (event: AnimationBoundaryEvent): Promise<void> => {
    const spin = visualSpinRef.current;
    if (spin === null) return;
    if (event === "SPIN_ANIMATION_DONE" && spin.stage === "spinning") {
      updateVisualSpin(setVisualSpin, visualSpinRef, { ...spin, stage: "highlight" });
      return;
    }
    if (event === "HIGHLIGHT_DONE" && spin.stage === "highlight") {
      updateVisualSpin(setVisualSpin, visualSpinRef, { ...spin, stage: "payout" });
      return;
    }
    if (event === "PAYOUT_DONE" && spin.stage === "payout") {
      const result = await executeCommand({ type: "settleSpin", spinId: spin.id });
      if (!mountedRef.current) return;
      if (result === null) {
        uncertainSettlementRef.current = spin;
        return;
      }
      if (result.snapshot.pendingSpin === null) {
        uncertainSettlementRef.current = null;
        updateVisualSpin(setVisualSpin, visualSpinRef, { ...spin, stage: "settled" });
        return;
      }
      if (
        result.status === 409 &&
        result.snapshot.pendingSpin.id === spin.id &&
        result.snapshot.pendingSpin.stage === "spinning"
      ) {
        uncertainSettlementRef.current = null;
        updateVisualSpin(setVisualSpin, visualSpinRef, {
          ...result.snapshot.pendingSpin,
          stage: "spinning",
        });
      }
      return;
    }
    if (event === "CLEAR_SETTLED_SPIN" && spin.stage === "settled") {
      updateVisualSpin(setVisualSpin, visualSpinRef, null);
    }
  }, [executeCommand]);

  const gameState = gameStateFrom(snapshot, visualSpin);
  const mutationsDisabled = snapshot === null || offline || commandPending ||
    !snapshot.capabilities.commands;
  return {
    snapshot,
    gameState,
    offline,
    mutationsDisabled,
    error,
    refresh,
    insertCoin,
    pullLever,
    play,
    buy,
    care,
    collect,
    setDisplayed,
    setPlacement,
    setSettings,
    advanceAnimation,
  };
}

function ecosystemTimestamp(snapshot: PublicSnapshot): number {
  const value = snapshot.ecosystem.lifecycle.lastSimulatedAt;
  if (value === null) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function shouldClaimDaily(snapshot: PublicSnapshot): boolean {
  return snapshot.lastGrantedLocalDate === null ||
    snapshot.localDate > snapshot.lastGrantedLocalDate;
}

function makeCommandRequest(
  payload: CommandPayload,
  sessionId: string,
  expectedRevision: number,
  commandId: string,
  issuedAt: string,
): CommandRequest {
  const base = { commandId, sessionId, expectedRevision, issuedAt };
  switch (payload.type) {
    case "claimDaily": return { ...base, type: "claimDaily" };
    case "insertCoin": return { ...base, type: "insertCoin" };
    case "pullLever": return { ...base, type: "pullLever", spinId: payload.spinId };
    case "settleSpin": return { ...base, type: "settleSpin", spinId: payload.spinId };
    case "buyItem": return { ...base, type: "buyItem", itemId: payload.itemId };
    case "careHabitat": return { ...base, type: "careHabitat", habitat: payload.habitat };
    case "collectHabitat": return { ...base, type: "collectHabitat", habitat: payload.habitat };
    case "setDisplay": return {
      ...base,
      type: "setDisplay",
      itemId: payload.itemId,
      displayed: payload.displayed,
    };
    case "setPlacement": return {
      ...base,
      type: "setPlacement",
      itemId: payload.itemId,
      positionId: payload.positionId,
    };
    case "updateSettings": return { ...base, type: "updateSettings", patch: payload.patch };
  }
}

function gameStateFrom(snapshot: PublicSnapshot | null, visualSpin: ResolvedSpin | null): GameState {
  const state = createInitialState();
  if (snapshot === null) return state;
  state.revision = snapshot.revision;
  state.wallet = snapshot.wallet;
  state.lastAwardDate = snapshot.lastGrantedLocalDate as GameState["lastAwardDate"];
  state.dailyLedgers = Object.fromEntries(Object.entries(snapshot.daily).map(([date, ledger]) => [
    date,
    { workCoins: ledger.workCoins, focusMinutes: 0, settledFocusHours: 0, focusCoins: 0 },
  ]));
  state.pityMisses = snapshot.pityCount;
  state.ownedCollectibles = [...snapshot.inventory];
  state.displayedCollectibles = [...snapshot.displaySlots];
  state.tablePlacements = snapshot.tablePlacements === undefined
    ? []
    : snapshot.tablePlacements.map((placement) => ({ ...placement }));
  state.ecosystem = structuredClone(snapshot.ecosystem);
  state.activeSpin = visualSpin;
  state.agentStatus = snapshot.agentStatus;
  state.settings = { ...snapshot.settings };
  return state;
}

function updateVisualSpin(
  setter: (spin: ResolvedSpin | null) => void,
  ref: { current: ResolvedSpin | null },
  spin: ResolvedSpin | null,
): void {
  ref.current = spin;
  setter(spin);
}

function defaultCommandId(): string {
  return globalThis.crypto.randomUUID();
}

function defaultNow(): Date {
  return new Date();
}

class HostRequestTimeoutError extends Error {
  constructor(kind: "command" | "refresh", timeoutMs: number) {
    super(`DSH Host ${kind} timed out after ${timeoutMs} ms`);
    this.name = "HostRequestTimeoutError";
  }
}

function normalizeRequestTimeout(timeoutMs: number): number {
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

function awaitHostRequest<T>(
  controller: AbortController,
  timeoutMs: number,
  kind: "command" | "refresh",
  request: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;

    const settle = (complete: () => void): void => {
      if (settled) return;
      settled = true;
      if (timeout !== null) globalThis.clearTimeout(timeout);
      controller.signal.removeEventListener("abort", onAbort);
      complete();
    };
    const onAbort = (): void => {
      const reason = controller.signal.reason;
      settle(() => {
        reject(reason instanceof Error ? reason : new Error("DSH Host request aborted"));
      });
    };

    controller.signal.addEventListener("abort", onAbort, { once: true });
    if (controller.signal.aborted) {
      onAbort();
      return;
    }

    timeout = globalThis.setTimeout(() => {
      const error = new HostRequestTimeoutError(kind, timeoutMs);
      controller.abort(error);
    }, timeoutMs);

    try {
      request().then(
        (value) => { settle(() => { resolve(value); }); },
        (cause: unknown) => { settle(() => { reject(cause); }); },
      );
    } catch (cause) {
      settle(() => { reject(cause); });
    }
  });
}

function shouldReportFailure(cause: unknown, signal: AbortSignal): boolean {
  return cause instanceof HostRequestTimeoutError || !signal.aborted;
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : "DSH Host unavailable";
}
