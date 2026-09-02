import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createInitialState, type GameState, type HabitatId } from "../domain/types";
import type { DshAdapter } from "../dsh/adapter";
import type { DshEvent } from "../dsh/events";
import { applyDailyOpen, applyDshEvent } from "../economy/work-rewards";
import { recoverInterruptedSpin, transitionMachine } from "../game/machine";
import type { OutcomeKind } from "../game/outcomes";
import { stableVerificationRoll, type RandomSource } from "../game/rng";
import { buyCollectible, setCollectibleDisplayed, setCollectiblePlacement } from "../inventory/inventory";
import { buyEcosystemItem, careForHabitat, collectHabitatProduce } from "../ecosystem/ecosystem";
import { advanceEcosystemTo } from "../ecosystem/lifecycle";
import type { TablePositionId } from "../domain/types";
import {
  RevisionConflictError,
  STATE_KEY,
  StateRepository,
  StorageWriteError,
} from "../storage/repository";
import { localDateKey, type Clock } from "../time/clock";

export interface GameControllerDependencies {
  repository: StateRepository;
  adapter: DshAdapter;
  clock: Clock;
  rng: RandomSource;
  createId(): string;
  consumeOutcomeOverride?(): OutcomeKind | null;
  mode: "writer" | "readonly" | "unsupported";
}

export interface GameController {
  state: GameState;
  mode: "writer" | "readonly" | "unsupported";
  error: string | null;
  lastEvent: DshEvent | null;
  insertCoin(): void;
  pullLever(): void;
  play(): void;
  advanceAnimation(
    event: "SPIN_ANIMATION_DONE" | "HIGHLIGHT_DONE" | "PAYOUT_DONE" | "CLEAR_SETTLED_SPIN",
  ): void;
  buy(id: string): void;
  care(habitat: HabitatId): void;
  collect(habitat: Extract<HabitatId, "garden" | "animals">): void;
  setDisplayed(id: string, displayed: boolean): void;
  setPlacement(id: string, positionId: TablePositionId | null): void;
  setSettings(patch: Partial<GameState["settings"]>): void;
  refreshForCurrentDate(): void;
  resetPrototype(): void;
}

interface InitializationResult {
  state: GameState;
  error: string | null;
  frozen: boolean;
  complete: boolean;
}

interface InitializedMode {
  mode: GameControllerDependencies["mode"];
  repository: StateRepository;
}

const REVISION_CONFLICT_MESSAGE = "存档已在其他窗口更新，请重试当前操作。";
const STORAGE_WRITE_MESSAGE = "无法写入存档；经济操作已暂停。";

export function useGameController(deps: GameControllerDependencies): GameController {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const [state, setState] = useState<GameState>(() => createInitialState());
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<DshEvent | null>(null);
  const stateRef = useRef(state);
  const frozenRef = useRef(false);
  const writerReadyRef = useRef(false);
  const initializedModeRef = useRef<InitializedMode | null>(null);

  const replaceState = useCallback((next: GameState): void => {
    stateRef.current = next;
    setState(next);
  }, []);

  const commit = useCallback((transition: (current: GameState) => GameState): void => {
    const currentDeps = depsRef.current;
    if (currentDeps.mode !== "writer" || !writerReadyRef.current || frozenRef.current) {
      return;
    }

    const previous = stateRef.current;
    const synchronizedEcosystem = advanceEcosystemTo(
      previous.ecosystem,
      currentDeps.clock.now(),
    );
    const synchronized = sameEcosystem(previous.ecosystem, synchronizedEcosystem)
      ? previous
      : { ...previous, ecosystem: synchronizedEcosystem };
    const next = transition(synchronized);
    if (next === previous) {
      return;
    }

    try {
      const saved = currentDeps.repository.save(next, previous.revision);
      replaceState(saved);
      setError(null);
    } catch (caught) {
      if (caught instanceof RevisionConflictError) {
        replaceState(currentDeps.repository.load());
        setError(REVISION_CONFLICT_MESSAGE);
        return;
      }

      if (caught instanceof StorageWriteError) {
        frozenRef.current = true;
        setError(STORAGE_WRITE_MESSAGE);
        return;
      }

      throw caught;
    }
  }, [replaceState]);

  useLayoutEffect(() => {
    const initializedMode = initializedModeRef.current;
    if (initializedMode?.mode === deps.mode && initializedMode.repository === deps.repository) {
      return;
    }
    writerReadyRef.current = false;
    initializedModeRef.current = { mode: deps.mode, repository: deps.repository };

    if (frozenRef.current) {
      return;
    }

    const initialized = initializeController(depsRef.current);
    frozenRef.current = frozenRef.current || initialized.frozen;
    replaceState(initialized.state);
    setError(initialized.error);
    writerReadyRef.current = deps.mode === "writer" && initialized.complete && !frozenRef.current;
  }, [deps.mode, deps.repository, replaceState]);

  useEffect(() => deps.adapter.subscribe((event) => {
    setLastEvent(event);
    commit((current) => applyDshEvent(current, event, {
      nowDate: localDateKey(depsRef.current.clock.now()),
      verificationRoll: stableVerificationRoll,
    }));
  }), [commit, deps.adapter]);

  useEffect(() => {
    if (deps.mode !== "readonly") {
      return undefined;
    }

    const onStorage = (event: StorageEvent): void => {
      if (event.key === STATE_KEY || event.key === null) {
        replaceState(deps.repository.load());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [deps.mode, deps.repository, replaceState]);

  useEffect(() => {
    if (deps.mode !== "writer") return undefined;
    const synchronize = (): void => commit((current) => current);
    const interval = globalThis.setInterval(synchronize, 60_000);
    const synchronizeIfVisible = (): void => {
      if (document.visibilityState === "visible") synchronize();
    };
    globalThis.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronizeIfVisible);
    return () => {
      globalThis.clearInterval(interval);
      globalThis.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", synchronizeIfVisible);
    };
  }, [commit, deps.mode]);

  const applyMachineEvent = useCallback((event: Parameters<typeof transitionMachine>[1]): void => {
    commit((current) => transitionMachine(current, event, {
      rng: depsRef.current.rng,
      now: () => depsRef.current.clock.now(),
      createId: () => depsRef.current.createId(),
      consumeOutcomeOverride: depsRef.current.consumeOutcomeOverride,
    }));
  }, [commit]);

  const insertCoin = useCallback(() => applyMachineEvent({ type: "INSERT_COIN" }), [applyMachineEvent]);
  const pullLever = useCallback(() => applyMachineEvent({ type: "PULL_LEVER" }), [applyMachineEvent]);
  const play = useCallback((): void => {
    commit((current) => {
      const machineDependencies = {
        rng: depsRef.current.rng,
        now: () => depsRef.current.clock.now(),
        createId: () => depsRef.current.createId(),
        consumeOutcomeOverride: depsRef.current.consumeOutcomeOverride,
      };
      const paid = current.activeSpin === null
        ? transitionMachine(current, { type: "INSERT_COIN" }, machineDependencies)
        : current;
      return paid.activeSpin?.stage === "coin-inserted"
        ? transitionMachine(paid, { type: "PULL_LEVER" }, machineDependencies)
        : paid;
    });
  }, [commit]);
  const advanceAnimation = useCallback((
    event: "SPIN_ANIMATION_DONE" | "HIGHLIGHT_DONE" | "PAYOUT_DONE" | "CLEAR_SETTLED_SPIN",
  ) => applyMachineEvent({ type: event }), [applyMachineEvent]);
  const buy = useCallback((id: string): void => {
    commit((current) => {
      const result = buyCollectible(current, id);
      if (result.ok) return result.state;
      if (result.reason !== "UNKNOWN_ITEM") return current;
      const ecosystemResult = buyEcosystemItem(current, id);
      return ecosystemResult.ok ? ecosystemResult.state : current;
    });
  }, [commit]);
  const care = useCallback((habitat: HabitatId): void => {
    commit((current) => {
      const result = careForHabitat(current, habitat, depsRef.current.clock.now());
      return result.ok ? result.state : current;
    });
  }, [commit]);
  const collect = useCallback((habitat: Extract<HabitatId, "garden" | "animals">): void => {
    commit((current) => {
      const result = collectHabitatProduce(current, habitat, depsRef.current.clock.now());
      return result.ok ? result.state : current;
    });
  }, [commit]);
  const setDisplayed = useCallback((id: string, displayed: boolean): void => {
    commit((current) => setCollectibleDisplayed(current, id, displayed));
  }, [commit]);
  const setPlacement = useCallback((id: string, positionId: TablePositionId | null): void => {
    commit((current) => setCollectiblePlacement(current, id, positionId));
  }, [commit]);
  const setSettings = useCallback((patch: Partial<GameState["settings"]>): void => {
    commit((current) => {
      const settings = { ...current.settings, ...patch };
      if (
        settings.muted === current.settings.muted &&
        settings.reducedMotion === current.settings.reducedMotion &&
        settings.scale === current.settings.scale
      ) {
        return current;
      }
      return { ...current, settings };
    });
  }, [commit]);
  const refreshForCurrentDate = useCallback((): void => {
    commit((current) => applyDailyOpen(current, localDateKey(depsRef.current.clock.now())));
  }, [commit]);
  const resetPrototype = useCallback((): void => {
    commit(() => applyDailyOpen(createInitialState(), localDateKey(depsRef.current.clock.now())));
  }, [commit]);

  return {
    state,
    mode: deps.mode,
    error,
    lastEvent,
    insertCoin,
    pullLever,
    play,
    advanceAnimation,
    buy,
    care,
    collect,
    setDisplayed,
    setPlacement,
    setSettings,
    refreshForCurrentDate,
    resetPrototype,
  };
}

function initializeController(deps: GameControllerDependencies): InitializationResult {
  let state = deps.repository.load();
  if (deps.mode !== "writer") {
    return {
      state: { ...state, ecosystem: advanceEcosystemTo(state.ecosystem, deps.clock.now()) },
      error: null,
      frozen: false,
      complete: true,
    };
  }

  const recovered = recoverInterruptedSpin(state);
  if (recovered !== state) {
    const result = saveInitializationTransition(deps.repository, state, recovered);
    if (!result.complete) {
      return result;
    }
    state = result.state;
  }

  const now = deps.clock.now();
  const opened = applyDailyOpen(state, localDateKey(now));
  const ecosystem = advanceEcosystemTo(opened.ecosystem, now);
  const initialized = sameEcosystem(opened.ecosystem, ecosystem)
    ? opened
    : { ...opened, ecosystem };
  if (initialized !== state) {
    return saveInitializationTransition(deps.repository, state, initialized);
  }

  return { state, error: null, frozen: false, complete: true };
}

function sameEcosystem(left: GameState["ecosystem"], right: GameState["ecosystem"]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function saveInitializationTransition(
  repository: StateRepository,
  previous: GameState,
  next: GameState,
): InitializationResult {
  try {
    return {
      state: repository.save(next, previous.revision),
      error: null,
      frozen: false,
      complete: true,
    };
  } catch (caught) {
    if (caught instanceof RevisionConflictError) {
      return {
        state: repository.load(),
        error: REVISION_CONFLICT_MESSAGE,
        frozen: false,
        complete: false,
      };
    }

    if (caught instanceof StorageWriteError) {
      return {
        state: previous,
        error: STORAGE_WRITE_MESSAGE,
        frozen: true,
        complete: false,
      };
    }

    throw caught;
  }
}
