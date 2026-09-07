import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { advanceWorld, MAX_WORLD_ELAPSED_MS } from "../ecosystem/world-clock";
import { parseGameState } from "./schema";

const now = new Date("2026-09-07T04:00:00.000Z");

describe("world-clock save compatibility", () => {
  it("retains old saves without introducing an unanchored world clock", () => {
    const old = createInitialState();
    old.wallet = 32;
    old.ownedCollectibles = ["plant"];
    const parsed = parseGameState(old);
    expect(parsed).toEqual(old);
    expect(parsed.ecosystem.world).toBeUndefined();
  });

  it("round-trips the clock, merchant purchases, wallet, plants and journal", () => {
    const state = createInitialState();
    state.ecosystem = advanceWorld(state.ecosystem, now, 0xffffffff);
    state.ecosystem.merchant = { visitId: "merchant-ffffffff-2", purchased: { "fish-feed": 2 }, soldCount: 1 };
    state.wallet = 32;
    expect(parseGameState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it.each([
    { elapsedMs: -1 }, { elapsedMs: 0.5 }, { elapsedMs: MAX_WORLD_ELAPSED_MS + 1 },
    { elapsedMs: Number.MAX_SAFE_INTEGER }, { elapsedMs: Number.NaN },
    { seed: -1 }, { seed: 0.1 }, { seed: 0x100000000 }, { lastRealAt: "bad" },
    { unexpected: true },
  ])("rejects malformed world state %#", (patch) => {
    const state = createInitialState();
    const input = { ...state, ecosystem: { ...state.ecosystem, world: { elapsedMs: 0, lastRealAt: now.toISOString(), seed: 1, ...patch } } };
    expect(() => parseGameState(input)).toThrow();
  });

  it.each([
    { visitId: "" }, { purchased: { "fish-feed": -1 } }, { soldCount: -1 },
    { soldCount: 0.5 }, { soldCount: Number.MAX_SAFE_INTEGER + 1 }, { unexpected: true },
    { soldCount: 25 }, { purchased: { "fish-feed": 3 } }, { visitId: "day-2" },
  ])("rejects malformed merchant ledgers %#", (patch) => {
    const state = createInitialState();
    const input = { ...state, ecosystem: { ...state.ecosystem, merchant: { visitId: "merchant-1-2", purchased: {}, soldCount: 0, ...patch } } };
    expect(() => parseGameState(input)).toThrow();
  });
});
