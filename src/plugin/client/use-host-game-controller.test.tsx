import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createInitialEcosystemState } from "../../domain/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandRequest, CommandResult, PublicSnapshot } from "../shared/contracts";
import type { GameApi } from "./api";
import { useHostGameController, type HostGameController } from "./use-host-game-controller";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useHostGameController", () => {
  it("sends one revision-guarded collection command for the visible habitat", async () => {
    const api = new RecordingApi(snapshot(), () => ({
      status: 200,
      snapshot: snapshot({ revision: 8 }),
    }));
    const { result } = renderHook(() => useHostGameController(options(api)));
    await waitFor(() => expect(result.current.snapshot?.revision).toBe(7));

    await act(async () => { await result.current.collect("garden"); });

    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({
      type: "collectHabitat",
      habitat: "garden",
      expectedRevision: 7,
      sessionId: "session-1",
    });
  });

  it("refreshes first and automatically claims the Host-provided unclaimed local date", async () => {
    const before = snapshot({
      revision: 3,
      wallet: 1,
      localDate: "2026-08-27",
      lastGrantedLocalDate: "2026-08-26",
    });
    const after = snapshot({ revision: 4, wallet: 4 });
    const api = new RecordingApi(before, () => ({ status: 200, snapshot: after }));

    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));

    await waitFor(() => expect(result.current.snapshot?.wallet).toBe(4));
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({
      type: "claimDaily",
      sessionId: "session-1",
      expectedRevision: 3,
    });
  });

  it("does not restart polling when Host state rerenders a controller using default dependencies", async () => {
    const api = new RecordingApi(snapshot());

    renderHook(() => useHostGameController({ api, sessionId: "session-1" }));

    await waitFor(() => expect(api.snapshotCalls).toBeGreaterThan(0));
    await act(async () => Promise.resolve());
    expect(api.snapshotCalls).toBe(1);
  });

  it("polls every two seconds, refreshes on lifecycle signals, and aborts work on unmount", async () => {
    vi.useFakeTimers();
    const api = new RecordingApi(snapshot());
    const hookOptions = options(api);
    const { unmount } = renderHook(() => useHostGameController(hookOptions));
    await act(async () => Promise.resolve());
    expect(api.snapshotCalls).toBe(1);

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(api.snapshotCalls).toBe(4);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(api.snapshotCalls).toBe(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(api.snapshotCalls).toBe(5);

    api.hangSnapshot = true;
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    const activeSignal = api.signals.at(-1)!;
    const callsAtUnmount = api.snapshotCalls;
    unmount();
    expect(activeSignal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(api.snapshotCalls).toBe(callsAtUnmount);
  });

  it("coalesces explicit, lifecycle, and polling refreshes while one request is in flight", async () => {
    vi.useFakeTimers();
    const firstSnapshot = deferredPromise<PublicSnapshot>();
    let snapshotCalls = 0;
    const api: GameApi = {
      getSnapshot: () => {
        snapshotCalls += 1;
        return snapshotCalls === 1 ? firstSnapshot.promise : Promise.resolve(snapshot());
      },
      command: () => Promise.resolve({ status: 200, snapshot: snapshot() }),
    };
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController({
      ...hookOptions,
      requestTimeoutMs: 5_000,
    }));
    await act(async () => Promise.resolve());
    expect(snapshotCalls).toBe(1);

    let refreshOne!: Promise<void>;
    let refreshTwo!: Promise<void>;
    act(() => {
      refreshOne = result.current.refresh();
      refreshTwo = result.current.refresh();
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(snapshotCalls).toBe(1);

    await act(async () => {
      firstSnapshot.resolve(snapshot());
      await Promise.all([refreshOne, refreshTwo]);
    });
    expect(result.current.snapshot?.revision).toBe(7);

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(snapshotCalls).toBe(2);
  });

  it("times out a never-resolving refresh and recovers on the next successful refresh", async () => {
    vi.useFakeTimers();
    let unavailable = true;
    let snapshotCalls = 0;
    const api: GameApi = {
      getSnapshot: () => {
        snapshotCalls += 1;
        return unavailable ? new Promise(() => undefined) : Promise.resolve(snapshot());
      },
      command: () => Promise.resolve({ status: 200, snapshot: snapshot() }),
    };
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController({
      ...hookOptions,
      requestTimeoutMs: 100,
    }));
    await act(async () => Promise.resolve());

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current).toMatchObject({
      offline: true,
      mutationsDisabled: true,
      error: "DSH Host refresh timed out after 100 ms",
    });
    expect(snapshotCalls).toBe(1);

    unavailable = false;
    await act(async () => { await result.current.refresh(); });
    expect(result.current).toMatchObject({
      offline: false,
      mutationsDisabled: false,
      error: null,
    });
    expect(result.current.snapshot?.revision).toBe(7);
    expect(snapshotCalls).toBe(2);
  });

  it("falls back to the safe default deadline when a timeout override is invalid", async () => {
    vi.useFakeTimers();
    const api: GameApi = {
      getSnapshot: () => new Promise(() => undefined),
      command: () => Promise.resolve({ status: 200, snapshot: snapshot() }),
    };
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController({
      ...hookOptions,
      requestTimeoutMs: 0,
    }));
    await act(async () => Promise.resolve());

    await act(async () => { await vi.advanceTimersByTimeAsync(9_999); });
    expect(result.current.offline).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current).toMatchObject({
      offline: true,
      error: "DSH Host refresh timed out after 10000 ms",
    });
  });

  it("times out a never-resolving command, releases pending state, and works after reconciliation", async () => {
    vi.useFakeTimers();
    let unavailable = true;
    let commandCalls = 0;
    const api: GameApi = {
      getSnapshot: () => Promise.resolve(snapshot()),
      command: () => {
        commandCalls += 1;
        return unavailable
          ? new Promise(() => undefined)
          : Promise.resolve({ status: 200, snapshot: snapshot({ revision: 8, wallet: 4 }) });
      },
    };
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController({
      ...hookOptions,
      requestTimeoutMs: 100,
    }));
    await act(async () => Promise.resolve());
    expect(result.current.mutationsDisabled).toBe(false);

    let command!: Promise<void>;
    act(() => { command = result.current.insertCoin(); });
    expect(result.current.mutationsDisabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await command;
    });
    expect(result.current).toMatchObject({
      offline: true,
      mutationsDisabled: true,
      error: "DSH Host command timed out after 100 ms",
    });
    expect(commandCalls).toBe(1);

    unavailable = false;
    await act(async () => { await result.current.refresh(); });
    expect(result.current.mutationsDisabled).toBe(false);
    await act(async () => { await result.current.insertCoin(); });
    expect(commandCalls).toBe(2);
    expect(result.current).toMatchObject({
      offline: false,
      mutationsDisabled: false,
      error: null,
    });
  });

  it("preserves the last successful snapshot and disables mutations while offline or a command is pending", async () => {
    const deferred = deferredPromise<CommandResult>();
    const api = new RecordingApi(snapshot(), () => deferred.promise);
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    act(() => { void result.current.insertCoin(); });
    await waitFor(() => expect(result.current.mutationsDisabled).toBe(true));

    deferred.resolve({ status: 200, snapshot: snapshot({ revision: 8, wallet: 4 }) });
    await waitFor(() => expect(result.current.mutationsDisabled).toBe(false));

    api.snapshotError = new TypeError("network unavailable");
    await act(async () => { await result.current.refresh(); });
    expect(result.current.snapshot?.revision).toBe(8);
    expect(result.current.offline).toBe(true);
    expect(result.current.mutationsDisabled).toBe(true);
  });

  it("does not let a slower poll overwrite a newer command response", async () => {
    const stalePoll = deferredPromise<PublicSnapshot>();
    let snapshotCalls = 0;
    const api: GameApi = {
      getSnapshot: () => {
        snapshotCalls += 1;
        return snapshotCalls === 1 ? Promise.resolve(snapshot()) : stalePoll.promise;
      },
      command: () => Promise.resolve({
        status: 200,
        snapshot: snapshot({ revision: 8, wallet: 4 }),
      }),
    };
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.snapshot?.revision).toBe(7));

    let refreshPromise!: Promise<void>;
    act(() => { refreshPromise = result.current.refresh(); });
    await act(async () => { await result.current.insertCoin(); });
    expect(result.current.snapshot).toMatchObject({ revision: 8, wallet: 4 });

    stalePoll.resolve(snapshot({ revision: 7, wallet: 5 }));
    await act(async () => { await refreshPromise; });
    expect(result.current.snapshot).toMatchObject({ revision: 8, wallet: 4 });
  });

  it("does not let an older same-revision ecology snapshot roll growth backward", async () => {
    const freshEcosystem = createInitialEcosystemState();
    freshEcosystem.lifecycle.lastSimulatedAt = "2026-08-27T06:00:00.000Z";
    freshEcosystem.lifecycle.fish.goldfish!.growth = 24;
    const staleEcosystem = createInitialEcosystemState();
    staleEcosystem.lifecycle.lastSimulatedAt = "2026-08-27T03:00:00.000Z";
    staleEcosystem.lifecycle.fish.goldfish!.growth = 12;
    let calls = 0;
    const api: GameApi = {
      getSnapshot: () => Promise.resolve(snapshot({
        ecosystem: calls++ === 0 ? freshEcosystem : staleEcosystem,
      })),
      command: () => Promise.resolve({ status: 200, snapshot: snapshot({ ecosystem: freshEcosystem }) }),
    };
    const { result } = renderHook(() => useHostGameController(options(api)));
    await waitFor(() => expect(
      result.current.gameState.ecosystem.lifecycle.fish.goldfish?.growth,
    ).toBe(24));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.gameState.ecosystem.lifecycle.fish.goldfish?.growth).toBe(24);
    expect(result.current.snapshot?.ecosystem.lifecycle.lastSimulatedAt)
      .toBe("2026-08-27T06:00:00.000Z");
  });

  it("bridges one Host spin through five visual stages and settles only after payout", async () => {
    const paid = snapshot({ pendingSpin: spin("paid") });
    const spinning = snapshot({ revision: 8, pendingSpin: spin("spinning") });
    const settled = snapshot({ revision: 9, wallet: 10, inventory: ["plant", "crystal"] });
    const api = new RecordingApi(paid, (request) => request.type === "pullLever"
      ? { status: 200, snapshot: spinning }
      : { status: 200, snapshot: settled });
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.gameState.activeSpin?.stage).toBe("coin-inserted"));

    await act(async () => { await result.current.pullLever(); });
    expect(result.current.gameState.activeSpin?.stage).toBe("spinning");
    await act(async () => { await result.current.advanceAnimation("SPIN_ANIMATION_DONE"); });
    expect(result.current.gameState.activeSpin?.stage).toBe("highlight");
    await act(async () => { await result.current.advanceAnimation("HIGHLIGHT_DONE"); });
    expect(result.current.gameState.activeSpin?.stage).toBe("payout");
    expect(result.current.gameState).toMatchObject({
      revision: 8,
      wallet: 5,
      ownedCollectibles: ["plant"],
      pityMisses: 1,
    });
    expect(api.requests.map(({ type }) => type)).toEqual(["pullLever"]);

    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });
    expect(api.requests.map(({ type }) => type)).toEqual(["pullLever", "settleSpin"]);
    expect(result.current.gameState).toMatchObject({
      revision: 9,
      wallet: 10,
      ownedCollectibles: ["plant", "crystal"],
      activeSpin: expect.objectContaining({ id: "spin-1", stage: "settled" }),
    });

    await act(async () => { await result.current.advanceAnimation("CLEAR_SETTLED_SPIN"); });
    expect(result.current.gameState.activeSpin).toBeNull();
  });

  it("uses one right-lever action to insert a coin and immediately start the same Host spin", async () => {
    const initial = snapshot({ pendingSpin: null });
    const paid = snapshot({
      revision: 8,
      wallet: 4,
      pendingSpin: spin("paid"),
    });
    const spinning = snapshot({
      revision: 9,
      wallet: 4,
      pendingSpin: spin("spinning"),
    });
    const api = new RecordingApi(initial, (request) => request.type === "insertCoin"
      ? { status: 200, snapshot: paid }
      : { status: 200, snapshot: spinning });
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.snapshot?.revision).toBe(7));

    await act(async () => { await result.current.play(); });

    expect(api.requests.map((request) => ({
      type: request.type,
      expectedRevision: request.expectedRevision,
      ...(request.type === "pullLever" ? { spinId: request.spinId } : {}),
    }))).toEqual([
      { type: "insertCoin", expectedRevision: 7 },
      { type: "pullLever", expectedRevision: 8, spinId: "spin-1" },
    ]);
    expect(result.current.gameState.activeSpin).toMatchObject({ id: "spin-1", stage: "spinning" });
  });

  it("reconciles a failed settlement transport to Host spinning on refresh and can settle again", async () => {
    const hostSpinning = snapshot({ pendingSpin: spin("spinning") });
    const hostSettled = snapshot({
      revision: 8,
      wallet: 10,
      inventory: ["plant", "crystal"],
      pendingSpin: null,
    });
    let settleAttempts = 0;
    const api = new RecordingApi(hostSpinning, () => {
      settleAttempts += 1;
      if (settleAttempts === 1) throw new TypeError("response lost");
      return { status: 200, snapshot: hostSettled };
    });
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.gameState.activeSpin?.stage).toBe("spinning"));
    await advanceToPayout(result);

    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });
    expect(result.current.gameState.activeSpin?.stage).toBe("payout");
    expect(result.current.offline).toBe(true);

    await act(async () => { await result.current.refresh(); });
    expect(result.current.gameState).toMatchObject({
      revision: 7,
      wallet: 5,
      ownedCollectibles: ["plant"],
      pityMisses: 1,
      activeSpin: expect.objectContaining({ id: "spin-1", stage: "spinning" }),
    });
    await advanceToPayout(result);
    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });

    expect(result.current.gameState).toMatchObject({
      revision: 8,
      wallet: 10,
      ownedCollectibles: ["plant", "crystal"],
      activeSpin: expect.objectContaining({ id: "spin-1", stage: "settled" }),
    });
    expect(api.requests.map(({ type, ...request }) => ({ type, spinId: "spinId" in request ? request.spinId : null })))
      .toEqual([
        { type: "settleSpin", spinId: "spin-1" },
        { type: "settleSpin", spinId: "spin-1" },
      ]);
  });

  it("reconciles a 409 with the same authoritative spinning spin and can settle again", async () => {
    const hostSpinning = snapshot({ pendingSpin: spin("spinning") });
    const hostSettled = snapshot({ revision: 8, wallet: 10, pendingSpin: null });
    let settleAttempts = 0;
    const api = new RecordingApi(hostSpinning, () => {
      settleAttempts += 1;
      return settleAttempts === 1
        ? { status: 409, snapshot: hostSpinning, errorCode: "revision-conflict" }
        : { status: 200, snapshot: hostSettled };
    });
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.gameState.activeSpin?.stage).toBe("spinning"));
    await advanceToPayout(result);

    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });
    expect(result.current.gameState).toMatchObject({
      revision: 7,
      wallet: 5,
      activeSpin: expect.objectContaining({ id: "spin-1", stage: "spinning" }),
    });

    await advanceToPayout(result);
    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });
    expect(result.current.gameState.activeSpin).toMatchObject({ id: "spin-1", stage: "settled" });
    expect(api.requests.map(({ type }) => type)).toEqual(["settleSpin", "settleSpin"]);
  });

  it("treats a lost settlement response followed by a cleared Host spin as settled without retrying", async () => {
    const hostSpinning = snapshot({ pendingSpin: spin("spinning") });
    const hostSettled = snapshot({
      revision: 8,
      wallet: 10,
      inventory: ["plant", "crystal"],
      pendingSpin: null,
    });
    let api!: RecordingApi;
    api = new RecordingApi(hostSpinning, () => {
      api.current = hostSettled;
      throw new TypeError("response lost after commit");
    });
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.gameState.activeSpin?.stage).toBe("spinning"));
    await advanceToPayout(result);

    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });
    expect(api.requests.map(({ type }) => type)).toEqual(["settleSpin"]);

    await act(async () => { await result.current.refresh(); });
    expect(result.current.gameState).toMatchObject({
      revision: 8,
      wallet: 10,
      ownedCollectibles: ["plant", "crystal"],
      activeSpin: expect.objectContaining({
        id: "spin-1",
        stage: "settled",
        reward: spin("spinning").reward,
      }),
    });
    expect(api.requests.map(({ type }) => type)).toEqual(["settleSpin"]);

    await act(async () => { await result.current.advanceAnimation("CLEAR_SETTLED_SPIN"); });
    expect(result.current.gameState.activeSpin).toBeNull();
  });

  it("preserves settled across overlapping equal-revision cleared refreshes until explicit clear", async () => {
    const hostSpinning = snapshot({ pendingSpin: spin("spinning") });
    const hostSettled = snapshot({
      revision: 8,
      wallet: 10,
      inventory: ["plant", "crystal"],
      pendingSpin: null,
    });
    const firstCleared = deferredPromise<PublicSnapshot>();
    const secondCleared = deferredPromise<PublicSnapshot>();
    const requests: CommandRequest[] = [];
    let snapshotCalls = 0;
    const api: GameApi = {
      getSnapshot: () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) return Promise.resolve(hostSpinning);
        if (snapshotCalls === 2) return firstCleared.promise;
        if (snapshotCalls === 3) return secondCleared.promise;
        return Promise.resolve(hostSettled);
      },
      command: (request) => {
        requests.push(request);
        return Promise.reject(new TypeError("response lost after commit"));
      },
    };
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.gameState.activeSpin?.stage).toBe("spinning"));
    await advanceToPayout(result);
    await act(async () => { await result.current.advanceAnimation("PAYOUT_DONE"); });

    let refreshOne!: Promise<void>;
    let refreshTwo!: Promise<void>;
    act(() => {
      refreshOne = result.current.refresh();
      refreshTwo = result.current.refresh();
    });
    firstCleared.resolve(hostSettled);
    secondCleared.resolve(hostSettled);
    await act(async () => { await Promise.all([refreshOne, refreshTwo]); });

    expect(result.current.gameState).toMatchObject({
      revision: 8,
      wallet: 10,
      ownedCollectibles: ["plant", "crystal"],
      activeSpin: expect.objectContaining({ id: "spin-1", stage: "settled" }),
    });
    expect(requests.map(({ type }) => type)).toEqual(["settleSpin"]);

    await act(async () => { await result.current.refresh(); });
    expect(result.current.gameState.activeSpin).toMatchObject({ id: "spin-1", stage: "settled" });
    expect(requests.map(({ type }) => type)).toEqual(["settleSpin"]);

    await act(async () => { await result.current.advanceAnimation("CLEAR_SETTLED_SPIN"); });
    expect(result.current.gameState.activeSpin).toBeNull();
  });

  it("restores Host spinning after refresh and clears a spin already settled elsewhere without a command", async () => {
    const api = new RecordingApi(snapshot({ pendingSpin: spin("spinning") }));
    const hookOptions = options(api);
    const { result } = renderHook(() => useHostGameController(hookOptions));
    await waitFor(() => expect(result.current.gameState.activeSpin?.stage).toBe("spinning"));

    api.current = snapshot({ revision: 9, wallet: 10, pendingSpin: null });
    await act(async () => { await result.current.refresh(); });

    expect(result.current.gameState.activeSpin).toBeNull();
    expect(api.requests).toEqual([]);
  });
});

class RecordingApi implements GameApi {
  current: PublicSnapshot;
  snapshotError: unknown = null;
  hangSnapshot = false;
  snapshotCalls = 0;
  readonly signals: AbortSignal[] = [];
  readonly requests: CommandRequest[] = [];

  constructor(
    initial: PublicSnapshot,
    private readonly respond: (request: CommandRequest) => CommandResult | Promise<CommandResult> =
      () => ({ status: 200, snapshot: initial }),
  ) {
    this.current = initial;
  }

  getSnapshot(_sessionId: string, signal?: AbortSignal): Promise<PublicSnapshot> {
    this.snapshotCalls += 1;
    if (signal !== undefined) this.signals.push(signal);
    if (this.snapshotError !== null) return Promise.reject(this.snapshotError);
    if (this.hangSnapshot) return new Promise(() => undefined);
    return Promise.resolve(this.current);
  }

  async command(request: CommandRequest, signal?: AbortSignal): Promise<CommandResult> {
    if (signal !== undefined) this.signals.push(signal);
    this.requests.push(request);
    const result = await this.respond(request);
    this.current = result.snapshot;
    return result;
  }
}

function options(api: GameApi) {
  let sequence = 0;
  return {
    api,
    sessionId: "session-1",
    createCommandId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    now: () => new Date("2026-08-27T00:00:00.000Z"),
  };
}

function snapshot(overrides: Partial<PublicSnapshot> = {}): PublicSnapshot {
  return {
    revision: 7,
    wallet: 5,
    localDate: "2026-08-27",
    lastGrantedLocalDate: "2026-08-27",
    daily: { "2026-08-27": { workCoins: 3 } },
    tokenEnergy: { progress: 1_850, dailyCoins: { "2026-08-27": 3 } },
    pityCount: 1,
    inventory: ["plant"],
    displaySlots: ["plant"],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    agentStatus: "idle",
    capabilities: { commands: true },
    ecosystem: createInitialEcosystemState(),
    ...overrides,
  };
}

function spin(stage: "paid" | "spinning"): NonNullable<PublicSnapshot["pendingSpin"]> {
  return {
    id: "spin-1",
    stage,
    reels: ["coin", "coin", "coin"],
    reward: { kind: "coins", amount: 5, reason: "five-coins" },
    pityAfter: 2,
    createdAt: "2026-08-27T00:00:00.000Z",
  };
}

function deferredPromise<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

async function advanceToPayout(result: { readonly current: HostGameController }): Promise<void> {
  await act(async () => { await result.current.advanceAnimation("SPIN_ANIMATION_DONE"); });
  await act(async () => { await result.current.advanceAnimation("HIGHLIGHT_DONE"); });
  expect(result.current.gameState.activeSpin?.stage).toBe("payout");
}
