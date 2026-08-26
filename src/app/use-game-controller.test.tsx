import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInitialState, type GameState } from "../domain/types";
import type { DshAdapter } from "../dsh/adapter";
import type { DshEvent } from "../dsh/events";
import { MockDshAdapter } from "../dsh/mock-adapter";
import { StateRepository, STATE_KEY } from "../storage/repository";
import { FixedClock } from "../time/clock";
import { useGameController } from "./use-game-controller";

const NOW = new Date("2026-08-26T08:00:00Z");

afterEach(cleanup);

function createHarness(options: {
  repository?: StateRepository;
  adapter?: MockDshAdapter;
  clock?: FixedClock;
  mode?: "writer" | "readonly" | "unsupported";
  createId?: () => string;
  consumeOutcomeOverride?: () => "none" | "refund" | "five-coins" | "common" | "rare" | "set" | null;
} = {}) {
  const clock = options.clock ?? new FixedClock(NOW);
  const adapter = options.adapter ?? new MockDshAdapter(clock, incrementalId("event"));
  const repository = options.repository ?? new StateRepository(localStorage);
  const hook = renderHook(
    () => useGameController({
      repository,
      adapter,
      clock,
      rng: { next: () => 0.7 },
      createId: options.createId ?? (() => "spin-1"),
      consumeOutcomeOverride: options.consumeOutcomeOverride,
      mode: options.mode ?? "writer",
    }),
  );
  return { ...hook, adapter, clock, repository };
}

function incrementalId(prefix: string): () => string {
  let id = 0;
  return () => `${prefix}-${id++}`;
}

function seed(repository: StateRepository, patch: Partial<GameState>): GameState {
  return repository.save({ ...createInitialState(), ...patch }, 0);
}

class InjectedAdapter implements DshAdapter {
  private listener: ((event: DshEvent) => void) | null = null;

  subscribe(listener: (event: DshEvent) => void): () => void {
    this.listener = listener;
    return () => { this.listener = null; };
  }

  emit(event: DshEvent): void {
    this.listener?.(event);
  }
}

describe("useGameController", () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ["malformed JSON", "not-json"],
    ["schema-invalid JSON", JSON.stringify({ ...createInitialState(), wallet: -1 })],
  ])("recovers a writer from %s and persists the daily grant", async (_description, raw) => {
    localStorage.setItem(STATE_KEY, raw);
    const repository = new StateRepository(
      localStorage,
      () => "2026-08-26T12:00:00.000Z",
    );

    const { result } = createHarness({ repository });

    await waitFor(() => expect(result.current.state.wallet).toBe(3));
    expect(() => JSON.parse(localStorage.getItem(STATE_KEY)!)).not.toThrow();
    expect(repository.load()).toMatchObject({ wallet: 3, revision: 1 });
    expect(localStorage.getItem("dsh-slot-corrupt-2026-08-26T12:00:00.000Z")).toBe(raw);
  });

  it("rejects fractional and non-finite focus minutes without persisting or awarding", async () => {
    const adapter = new InjectedAdapter();
    const repository = new StateRepository(localStorage);
    const { result } = renderHook(() => useGameController({
      repository,
      adapter,
      clock: new FixedClock(NOW),
      rng: { next: () => 0.7 },
      createId: () => "unused-spin",
      mode: "writer",
    }));
    await waitFor(() => expect(result.current.state.wallet).toBe(3));

    for (const [id, minutes] of [
      ["fractional-focus", 0.5],
      ["nan-focus", Number.NaN],
      ["infinite-focus", Number.POSITIVE_INFINITY],
    ] as const) {
      act(() => {
        adapter.emit({
          id,
          type: "focus.minutes",
          occurredAt: "2026-08-26T10:00:00+08:00",
          minutes,
        });
      });
    }

    expect(result.current.state).toMatchObject({ wallet: 3, revision: 1, dailyLedgers: {} });
    expect(repository.load()).toMatchObject({ wallet: 3, revision: 1, dailyLedgers: {} });
  });

  it("applies work events and persists a paid spin", async () => {
    const { result, adapter, repository } = createHarness();
    await waitFor(() => expect(result.current.state.wallet).toBe(3));

    act(() => { adapter.completeTask(); });
    expect(result.current.state.wallet).toBe(4);
    expect(repository.load().wallet).toBe(4);

    act(() => { result.current.insertCoin(); });

    expect(result.current.state.wallet).toBe(3);
    expect(result.current.state.activeSpin?.stage).toBe("coin-inserted");
    expect(repository.load().activeSpin?.id).toBe("spin-1");
    expect(result.current.lastEvent?.type).toBe("task.completed");
  });

  it("persists queued verification events instead of losing them", async () => {
    const { result, adapter, repository } = createHarness();
    await waitFor(() => expect(result.current.state.wallet).toBe(3));

    act(() => { adapter.verifyTask("task-arrives-later"); });

    const persisted = repository.load();
    expect(persisted.pendingVerifications["task-arrives-later"]).toBeDefined();
    expect(Object.keys(persisted.processedEvents)).toHaveLength(1);
    expect(result.current.lastEvent).toMatchObject({
      type: "task.verified",
      taskId: "task-arrives-later",
    });
  });

  it("keeps one live adapter subscription in StrictMode and removes it on unmount", async () => {
    const clock = new FixedClock(NOW);
    const adapter = new MockDshAdapter(clock, incrementalId("strict-event"));
    const repository = new StateRepository(localStorage);
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(
      () => useGameController({
        repository,
        adapter,
        clock,
        rng: { next: () => 0.7 },
        createId: () => "spin-1",
        mode: "writer",
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.wallet).toBe(3));

    act(() => { adapter.addFocusHour(); });
    expect(repository.load()).toMatchObject({ wallet: 5, revision: 2 });

    unmount();
    adapter.addFocusHour();
    expect(repository.load()).toMatchObject({ wallet: 5, revision: 2 });
  });

  it("persists every machine command through settlement and clearing", async () => {
    const { result, repository } = createHarness({
      consumeOutcomeOverride: () => "five-coins",
    });
    await waitFor(() => expect(result.current.state.wallet).toBe(3));

    act(() => { result.current.insertCoin(); });
    expect(repository.load().activeSpin?.stage).toBe("coin-inserted");
    act(() => { result.current.pullLever(); });
    expect(repository.load().activeSpin?.stage).toBe("spinning");
    act(() => { result.current.advanceAnimation("SPIN_ANIMATION_DONE"); });
    expect(repository.load().activeSpin?.stage).toBe("highlight");
    act(() => { result.current.advanceAnimation("HIGHLIGHT_DONE"); });
    expect(repository.load().activeSpin?.stage).toBe("payout");
    act(() => { result.current.advanceAnimation("PAYOUT_DONE"); });
    expect(repository.load()).toMatchObject({ wallet: 7, activeSpin: { stage: "settled" } });
    act(() => { result.current.advanceAnimation("CLEAR_SETTLED_SPIN"); });
    expect(repository.load()).toMatchObject({ wallet: 7, activeSpin: null, revision: 7 });
  });

  it("does not let a purchase replace the new collectible locked by an inserted spin", async () => {
    const repository = new StateRepository(localStorage);
    seed(repository, {
      wallet: 20,
      lastAwardDate: "2026-08-26",
      activeSpin: {
        id: "spin-locked-plant",
        stage: "coin-inserted",
        reels: ["leaf", "leaf", "leaf"],
        reward: {
          kind: "collectible",
          collectibleId: "plant",
          isDuplicate: false,
          conversionCoins: 0,
          bonusCoins: 0,
        },
        pityAfter: 0,
        createdAt: "2026-08-26T00:00:00.000Z",
      },
    });
    const { result } = createHarness({ repository });
    await waitFor(() => expect(result.current.state.activeSpin?.id).toBe("spin-locked-plant"));

    act(() => { result.current.buy("plant"); });

    expect(result.current.state).toMatchObject({
      wallet: 20,
      revision: 1,
      ownedCollectibles: [],
      activeSpin: {
        id: "spin-locked-plant",
        reward: { kind: "collectible", collectibleId: "plant", isDuplicate: false },
      },
    });
    expect(repository.load()).toEqual(result.current.state);
  });

  it("persists buying and changing an owned collectible display", async () => {
    const repository = new StateRepository(localStorage);
    seed(repository, { wallet: 20, lastAwardDate: "2026-08-26" });
    const { result } = createHarness({ repository });
    await waitFor(() => expect(result.current.state.wallet).toBe(20));

    act(() => { result.current.buy("plant"); });
    expect(repository.load()).toMatchObject({
      wallet: 14,
      ownedCollectibles: ["plant"],
      displayedCollectibles: ["plant"],
    });

    act(() => { result.current.setDisplayed("plant", false); });
    expect(repository.load().displayedCollectibles).toEqual([]);
  });

  it("persists settings patches without erasing other settings", async () => {
    const { result, repository } = createHarness();
    await waitFor(() => expect(result.current.state.wallet).toBe(3));

    act(() => { result.current.setSettings({ muted: false, scale: 2 }); });

    expect(repository.load().settings).toEqual({
      muted: false,
      reducedMotion: false,
      scale: 2,
    });
  });

  it("recovers and persists an interrupted spin before applying the daily grant", async () => {
    const repository = new StateRepository(localStorage);
    seed(repository, {
      wallet: 2,
      activeSpin: {
        id: "interrupted",
        stage: "spinning",
        reels: ["coin", "coin", "coin"],
        reward: { kind: "coins", amount: 5, reason: "five-coins" },
        pityAfter: 4,
        createdAt: "2026-08-26T07:00:00.000Z",
      },
    });

    const { result } = createHarness({ repository });
    await waitFor(() => expect(result.current.state.activeSpin?.stage).toBe("settled"));

    expect(result.current.state).toMatchObject({ wallet: 10, revision: 3, pityMisses: 4 });
    expect(repository.load()).toMatchObject({ wallet: 10, revision: 3, activeSpin: { stage: "settled" } });
  });

  it("reloads once on revision conflict without replaying the rejected command", async () => {
    const createId = incrementalId("spin");
    const repository = new StateRepository(localStorage);
    const externalRepository = new StateRepository(localStorage);
    const { result } = createHarness({ repository, createId });
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 3, revision: 1 }));
    externalRepository.save({ ...repository.load(), wallet: 9 }, 1);

    act(() => { result.current.insertCoin(); });

    expect(result.current.state).toMatchObject({ wallet: 9, revision: 2, activeSpin: null });
    expect(result.current.error).toMatch(/其他窗口|重试/);
    expect(repository.load().activeSpin).toBeNull();

    act(() => { result.current.insertCoin(); });
    expect(result.current.state.activeSpin?.id).toBe("spin-1");
  });

  it("retains the last good state and freezes all later writes after a storage failure", async () => {
    const storage = new ToggleWriteStorage(localStorage);
    const repository = new StateRepository(storage);
    const { result, adapter } = createHarness({ repository });
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 3, revision: 1 }));
    storage.rejectWrites = true;

    act(() => { result.current.insertCoin(); });
    expect(result.current.state).toMatchObject({ wallet: 3, revision: 1, activeSpin: null });
    expect(result.current.error).toMatch(/写入|暂停/);

    storage.rejectWrites = false;
    act(() => {
      adapter.completeTask();
      result.current.setSettings({ muted: false });
      result.current.resetPrototype();
    });
    expect(result.current.state).toMatchObject({ wallet: 3, revision: 1 });
    expect(result.current.state.settings.muted).toBe(true);
    expect(repository.load()).toMatchObject({ wallet: 3, revision: 1 });
  });

  it("mirrors storage changes in readonly mode without applying local economy events", async () => {
    const repository = new StateRepository(localStorage);
    seed(repository, { wallet: 7, lastAwardDate: "2026-08-26" });
    const { result, adapter } = createHarness({ repository, mode: "readonly" });
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 7, revision: 1 }));

    act(() => {
      adapter.addFocusHour();
      result.current.insertCoin();
      result.current.setSettings({ muted: false });
    });
    expect(result.current.state).toMatchObject({ wallet: 7, revision: 1, activeSpin: null });
    expect(result.current.lastEvent?.type).toBe("focus.minutes");

    repository.save({ ...repository.load(), wallet: 11 }, 1);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: STATE_KEY })); });
    expect(result.current.state).toMatchObject({ wallet: 11, revision: 2 });
  });

  it("initializes one writer acquisition before immediate events and commands", async () => {
    const clock = new FixedClock(NOW);
    const adapter = new MockDshAdapter(clock, incrementalId("acquired-event"));
    const repository = new StateRepository(localStorage);
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "writer" | "readonly" }) => useGameController({
        repository,
        adapter,
        clock,
        rng: { next: () => 0.7 },
        createId: () => "acquired-spin",
        mode,
      }),
      {
        initialProps: { mode: "readonly" } as { mode: "writer" | "readonly" },
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 0, revision: 0 }));

    rerender({ mode: "writer" });
    expect(result.current.state).toMatchObject({ wallet: 3, revision: 1 });

    act(() => {
      adapter.completeTask();
      result.current.insertCoin();
    });
    expect(repository.load()).toMatchObject({
      wallet: 3,
      revision: 3,
      activeSpin: { id: "acquired-spin", stage: "coin-inserted" },
    });

    rerender({ mode: "writer" });
    expect(repository.load().revision).toBe(3);
  });

  it("recovers an interrupted spin when unsupported mode acquires writer", async () => {
    const clock = new FixedClock(NOW);
    const adapter = new MockDshAdapter(clock, incrementalId("recovery-event"));
    const repository = new StateRepository(localStorage);
    seed(repository, {
      wallet: 2,
      activeSpin: {
        id: "acquired-interrupted",
        stage: "spinning",
        reels: ["coin", "coin", "coin"],
        reward: { kind: "coins", amount: 5, reason: "five-coins" },
        pityAfter: 3,
        createdAt: "2026-08-26T07:00:00.000Z",
      },
    });
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "writer" | "unsupported" }) => useGameController({
        repository,
        adapter,
        clock,
        rng: { next: () => 0.7 },
        createId: () => "unused-spin",
        mode,
      }),
      {
        initialProps: { mode: "unsupported" } as { mode: "writer" | "unsupported" },
      },
    );
    await waitFor(() => expect(result.current.state.activeSpin?.stage).toBe("spinning"));

    rerender({ mode: "writer" });
    expect(result.current.state).toMatchObject({
      wallet: 10,
      revision: 3,
      pityMisses: 3,
      activeSpin: { id: "acquired-interrupted", stage: "settled" },
    });

    act(() => { result.current.advanceAnimation("CLEAR_SETTLED_SPIN"); });
    expect(repository.load()).toMatchObject({ wallet: 10, revision: 4, activeSpin: null });
  });

  it("blocks events and commands after a recovery conflict during writer acquisition", async () => {
    const baseRepository = new StateRepository(localStorage);
    seed(baseRepository, {
      wallet: 2,
      activeSpin: {
        id: "conflicted-recovery",
        stage: "spinning",
        reels: ["coin", "coin", "coin"],
        reward: { kind: "coins", amount: 5, reason: "five-coins" },
        pityAfter: 3,
        createdAt: "2026-08-26T07:00:00.000Z",
      },
    });
    const repository = new ConflictOnSaveRepository(localStorage, (current) => ({
      ...current,
      wallet: 20,
    }));
    const { result, adapter } = createHarness({ repository });
    await waitFor(() => expect(result.current.error).toMatch(/其他窗口|重试/));
    expect(result.current.state).toMatchObject({
      wallet: 20,
      revision: 2,
      activeSpin: { id: "conflicted-recovery", stage: "spinning" },
    });

    act(() => {
      adapter.addFocusHour();
      result.current.advanceAnimation("SPIN_ANIMATION_DONE");
    });

    expect(result.current.lastEvent?.type).toBe("focus.minutes");
    expect(repository.load()).toMatchObject({
      wallet: 20,
      revision: 2,
      dailyLedgers: {},
      activeSpin: { id: "conflicted-recovery", stage: "spinning" },
    });
  });

  it("blocks events and commands after a daily-grant conflict during writer acquisition", async () => {
    const repository = new ConflictOnSaveRepository(localStorage, (current) => ({
      ...current,
      wallet: 8,
    }));
    const { result, adapter } = createHarness({ repository });
    await waitFor(() => expect(result.current.error).toMatch(/其他窗口|重试/));
    expect(result.current.state).toMatchObject({
      wallet: 8,
      revision: 1,
      lastAwardDate: null,
      activeSpin: null,
    });

    act(() => {
      adapter.completeTask();
      result.current.insertCoin();
    });

    expect(result.current.lastEvent?.type).toBe("task.completed");
    expect(repository.load()).toMatchObject({
      wallet: 8,
      revision: 1,
      lastAwardDate: null,
      processedEvents: {},
      activeSpin: null,
    });
  });

  it("loads state but rejects commands and storage mirroring in unsupported mode", async () => {
    const repository = new StateRepository(localStorage);
    seed(repository, { wallet: 7, lastAwardDate: "2026-08-26" });
    const { result, adapter } = createHarness({ repository, mode: "unsupported" });
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 7, revision: 1 }));

    act(() => {
      adapter.completeTask();
      result.current.insertCoin();
      result.current.refreshForCurrentDate();
      result.current.resetPrototype();
    });
    repository.save({ ...repository.load(), wallet: 12 }, 1);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: STATE_KEY })); });

    expect(result.current.mode).toBe("unsupported");
    expect(result.current.state).toMatchObject({ wallet: 7, revision: 1, activeSpin: null });
  });

  it("grants once on a new local day and ignores clock rollback", async () => {
    const clock = new FixedClock(NOW);
    const { result, repository } = createHarness({ clock });
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 3, revision: 1 }));

    clock.set(new Date("2026-08-27T08:00:00Z"));
    act(() => { result.current.refreshForCurrentDate(); });
    expect(result.current.state).toMatchObject({ wallet: 6, revision: 2, lastAwardDate: "2026-08-27" });

    clock.set(new Date("2026-08-26T08:00:00Z"));
    act(() => { result.current.refreshForCurrentDate(); });
    expect(result.current.state).toMatchObject({ wallet: 6, revision: 2, lastAwardDate: "2026-08-27" });
    expect(repository.load().revision).toBe(2);
  });

  it("resets to a freshly granted prototype at a monotonic revision", async () => {
    const { result, adapter, repository } = createHarness();
    await waitFor(() => expect(result.current.state).toMatchObject({ wallet: 3, revision: 1 }));
    act(() => { adapter.completeTask(); });
    expect(result.current.state).toMatchObject({ wallet: 4, revision: 2 });

    act(() => { result.current.resetPrototype(); });

    expect(result.current.state).toMatchObject({
      wallet: 3,
      revision: 3,
      lastAwardDate: "2026-08-26",
      processedEvents: {},
      completedTasks: {},
      activeSpin: null,
    });
    expect(repository.load()).toEqual(result.current.state);
  });
});

class ToggleWriteStorage implements Storage {
  rejectWrites = false;

  constructor(private readonly storage: Storage) {}

  get length(): number { return this.storage.length; }
  clear(): void { this.storage.clear(); }
  getItem(key: string): string | null { return this.storage.getItem(key); }
  key(index: number): string | null { return this.storage.key(index); }
  removeItem(key: string): void { this.storage.removeItem(key); }
  setItem(key: string, value: string): void {
    if (this.rejectWrites) throw new DOMException("quota", "QuotaExceededError");
    this.storage.setItem(key, value);
  }
}

class ConflictOnSaveRepository extends StateRepository {
  private hasInjectedConflict = false;
  private readonly externalRepository: StateRepository;

  constructor(
    storage: Storage,
    private readonly mutateExternalState: (current: GameState) => GameState,
  ) {
    super(storage);
    this.externalRepository = new StateRepository(storage);
  }

  override save(next: GameState, expectedRevision: number): GameState {
    if (!this.hasInjectedConflict) {
      this.hasInjectedConflict = true;
      const current = this.externalRepository.load();
      this.externalRepository.save(this.mutateExternalState(current), current.revision);
    }
    return super.save(next, expectedRevision);
  }
}
