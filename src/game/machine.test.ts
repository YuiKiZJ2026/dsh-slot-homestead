import { describe, expect, it } from "vitest";
import { createInitialState, type GameState, type ResolvedSpin } from "../domain/types";
import { recoverInterruptedSpin, transitionMachine } from "./machine";

const deps = {
  rng: { next: () => 0.70 },
  now: () => new Date("2026-08-26T12:00:00Z"),
  createId: () => "spin-1",
};

const events = [
  { type: "INSERT_COIN" },
  { type: "PULL_LEVER" },
  { type: "SPIN_ANIMATION_DONE" },
  { type: "HIGHLIGHT_DONE" },
  { type: "PAYOUT_DONE" },
  { type: "CLEAR_SETTLED_SPIN" },
] as const;

function stateWithStage(stage: ResolvedSpin["stage"]): GameState {
  const state = createInitialState();
  state.wallet = 3;
  state.activeSpin = {
    id: `spin-${stage}`,
    stage,
    reels: ["coin", "coin", "coin"],
    reward: { kind: "coins", amount: 5, reason: "five-coins" },
    pityAfter: 2,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
  return state;
}

describe("slot machine transitions", () => {
  it("moves through paid insert, pull, highlight, payout, and settlement", () => {
    const start = createInitialState();
    start.wallet = 3;

    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, deps);
    const spinning = transitionMachine(inserted, { type: "PULL_LEVER" }, deps);
    const highlight = transitionMachine(spinning, { type: "SPIN_ANIMATION_DONE" }, deps);
    const payout = transitionMachine(highlight, { type: "HIGHLIGHT_DONE" }, deps);
    const settled = transitionMachine(payout, { type: "PAYOUT_DONE" }, deps);

    expect(inserted.activeSpin?.stage).toBe("coin-inserted");
    expect(spinning.activeSpin?.stage).toBe("spinning");
    expect(highlight.activeSpin?.stage).toBe("highlight");
    expect(payout.activeSpin?.stage).toBe("payout");
    expect(settled.activeSpin?.stage).toBe("settled");
    expect(settled.wallet).toBe(7);
  });

  it("keeps an inserted spin ready after refresh", () => {
    const start = createInitialState();
    start.wallet = 1;

    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, deps);

    expect(recoverInterruptedSpin(inserted).activeSpin?.stage).toBe("coin-inserted");
  });

  it.each(["spinning", "highlight", "payout"] as const)(
    "settles a %s spin exactly once during recovery",
    (stage) => {
      const state = stateWithStage(stage);
      const recovered = recoverInterruptedSpin(state);
      const recoveredAgain = recoverInterruptedSpin(recovered);

      expect(recovered.activeSpin?.stage).toBe("settled");
      expect(recovered.wallet).toBe(8);
      expect(recoveredAgain).toBe(recovered);
    },
  );

  it("preserves an already settled spin during recovery", () => {
    const state = stateWithStage("settled");

    expect(recoverInterruptedSpin(state)).toBe(state);
  });

  it("clears a spin only after its reward has settled", () => {
    const payout = stateWithStage("payout");
    const settled = transitionMachine(payout, { type: "PAYOUT_DONE" }, deps);
    const cleared = transitionMachine(settled, { type: "CLEAR_SETTLED_SPIN" }, deps);

    expect(cleared.activeSpin).toBeNull();
    expect(cleared.wallet).toBe(8);
  });

  it.each([
    ["empty", createInitialState(), events.filter((event) => event.type !== "INSERT_COIN")],
    ["coin-inserted", stateWithStage("coin-inserted"), events.filter((event) => event.type !== "PULL_LEVER")],
    ["spinning", stateWithStage("spinning"), events.filter((event) => event.type !== "SPIN_ANIMATION_DONE")],
    ["highlight", stateWithStage("highlight"), events.filter((event) => event.type !== "HIGHLIGHT_DONE")],
    ["payout", stateWithStage("payout"), events.filter((event) => event.type !== "PAYOUT_DONE")],
    ["settled", stateWithStage("settled"), events.filter((event) => event.type !== "CLEAR_SETTLED_SPIN")],
  ] as const)("ignores every invalid event while %s", (_stage, state, invalidEvents) => {
    for (const event of invalidEvents) {
      expect(transitionMachine(state, event, deps)).toBe(state);
    }
  });

  it.each([
    ["wallet has no coin", () => createInitialState()],
    ["an active spin already exists", () => stateWithStage("coin-inserted")],
  ] as const)("does not consume creation dependencies when %s", (_reason, createState) => {
    const state = createState();
    const calls: string[] = [];
    const rejectedInsertDeps = {
      rng: { next: () => { calls.push("rng"); return 0.70; } },
      now: () => { calls.push("now"); return new Date("2026-08-26T12:00:00Z"); },
      createId: () => { calls.push("createId"); return "spin-rejected"; },
      consumeOutcomeOverride: () => { calls.push("consumeOutcomeOverride"); return "five-coins" as const; },
    };

    expect(transitionMachine(state, { type: "INSERT_COIN" }, rejectedInsertDeps)).toBe(state);
    expect(calls).toEqual([]);
  });

  it("consumes each outcome override only for coin insertion", () => {
    const overrides: Array<"five-coins" | null> = ["five-coins", null];
    let overrideCalls = 0;
    let randomCalls = 0;
    const controlledDeps = {
      ...deps,
      rng: { next: () => { randomCalls += 1; return 0; } },
      consumeOutcomeOverride: () => {
        overrideCalls += 1;
        return overrides.shift() ?? null;
      },
    };
    const start = createInitialState();
    start.wallet = 2;

    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, controlledDeps);
    const spinning = transitionMachine(inserted, { type: "PULL_LEVER" }, controlledDeps);
    const highlight = transitionMachine(spinning, { type: "SPIN_ANIMATION_DONE" }, controlledDeps);
    const payout = transitionMachine(highlight, { type: "HIGHLIGHT_DONE" }, controlledDeps);
    const settled = transitionMachine(payout, { type: "PAYOUT_DONE" }, controlledDeps);
    const cleared = transitionMachine(settled, { type: "CLEAR_SETTLED_SPIN" }, controlledDeps);
    const nextInserted = transitionMachine(cleared, { type: "INSERT_COIN" }, controlledDeps);

    expect(inserted.activeSpin?.reward).toEqual({ kind: "coins", amount: 5, reason: "five-coins" });
    expect(nextInserted.activeSpin?.reward).toEqual({ kind: "none" });
    expect(overrideCalls).toBe(2);
    expect(randomCalls).toBe(2);
  });

  it("does not mutate states passed to transitions or recovery", () => {
    const start = createInitialState();
    start.wallet = 1;
    const startBefore = structuredClone(start);

    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, deps);
    const spinning = transitionMachine(inserted, { type: "PULL_LEVER" }, deps);
    const spinningBefore = structuredClone(spinning);
    const recovered = recoverInterruptedSpin(spinning);

    expect(start).toEqual(startBefore);
    expect(inserted).not.toBe(start);
    expect(spinning).toEqual(spinningBefore);
    expect(recovered).not.toBe(spinning);
  });
});
