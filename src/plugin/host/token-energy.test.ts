import { describe, expect, it } from "vitest";
import type { EligibleTurnUsage, HostState } from "../shared/contracts";
import { hostStateSchema } from "../shared/contracts";
import { applyEligibleTurnUsage, weightedTokenUsage } from "./token-energy";

const day = "2026-08-26";

function state(overrides: Partial<HostState> = {}): HostState {
  return {
    schemaVersion: 2,
    revision: 4,
    wallet: 0,
    lastGrantedLocalDate: null,
    daily: {},
    tokenEnergy: { progress: 0, dailyCoins: {} },
    tokenUsageWatermarks: {},
    pityCount: 0,
    inventory: [],
    displaySlots: [],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    recentCommands: {},
    ...overrides,
  };
}

function event(
  usageSeqs: readonly [number, ...number[]],
  outputTokens: number,
): EligibleTurnUsage {
  const [first, ...rest] = usageSeqs;
  return {
    sessionId: "session-1",
    turn: 3,
    usageSeqs: [first, ...rest],
    stepUsages: [
      { inputTokens: 0, outputTokens },
      ...rest.map(() => ({ inputTokens: 0, outputTokens: 0 })),
    ],
    occurredAt: "2026-08-26T12:00:00+08:00",
  };
}

describe("token energy", () => {
  it("stores only the latest processed sequence for one session", () => {
    const next = applyEligibleTurnUsage(state(), event([23], 200), day);

    expect(next).toMatchObject({ tokenUsageWatermarks: { "session-1": 23 } });
    expect(next).not.toHaveProperty("tokenUsageReceipts");
  });

  it("weights disjoint usage and never adds reasoning twice", () => {
    expect(
      weightedTokenUsage({
        inputTokens: 1_000,
        outputTokens: 2_500,
        cacheWriteTokens: 1_000,
        cacheReadTokens: 5_000,
        reasoningTokens: 2_000,
      }),
    ).toBe(2_800);
  });

  it("converts carried progress plus eligible usage into one coin", () => {
    const next = applyEligibleTurnUsage(
      state({ tokenEnergy: { progress: 2_800, dailyCoins: {} } }),
      event([17], 200),
      day,
    );

    expect(next).toMatchObject({
      revision: 5,
      wallet: 1,
      daily: { [day]: { workCoins: 1 } },
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 1 } },
      tokenUsageWatermarks: { "session-1": 17 },
    });
  });

  it("credits at most three thousand effective tokens for one turn", () => {
    const next = applyEligibleTurnUsage(state(), event([18], 10_000), day);

    expect(next).toMatchObject({
      revision: 5,
      wallet: 1,
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 1 } },
    });
  });

  it.each([
    state({ tokenEnergy: { progress: 2_800, dailyCoins: { [day]: 8 } } }),
    state({ daily: { [day]: { workCoins: 25 } } }),
  ])("advances replay protection without accumulating usage once a daily cap is reached", (base) => {
    const next = applyEligibleTurnUsage(base, event([19], 200), day);

    expect(next).toMatchObject({
      revision: 5,
      wallet: base.wallet,
      daily: base.daily,
      tokenEnergy: base.tokenEnergy,
      tokenUsageWatermarks: { "session-1": 19 },
    });
  });

  it("does not change the wallet when the same sequence is submitted after restart", () => {
    const once = applyEligibleTurnUsage(state(), event([20], 3_000), day);
    const restarted = hostStateSchema.parse(JSON.parse(JSON.stringify(once)));
    const twice = applyEligibleTurnUsage(restarted, event([20], 3_000), day);

    expect(twice).toBe(restarted);
    expect(twice.wallet).toBe(1);
  });

  it("rejects a whole multi-step turn when any sequence is at or below the watermark", () => {
    const base = state({ tokenUsageWatermarks: { "session-1": 21 } });

    expect(applyEligibleTurnUsage(base, event([21, 22], 3_000), day)).toBe(base);
  });

  it("aggregates matching multi-step usages and advances to the final sequence", () => {
    const next = applyEligibleTurnUsage(state(), {
      ...event([24, 29], 0),
      stepUsages: [
        { inputTokens: 0, outputTokens: 1_000 },
        { inputTokens: 0, outputTokens: 2_000 },
      ],
    }, day);

    expect(next).toMatchObject({
      wallet: 1,
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 1 } },
      tokenUsageWatermarks: { "session-1": 29 },
    });
  });

  it("uses exact legacy receipts to recover a hole below the migrated v1 watermark", () => {
    const migrated = hostStateSchema.parse({
      schemaVersion: 1,
      revision: 4,
      wallet: 1,
      lastGrantedLocalDate: null,
      daily: { [day]: { workCoins: 1 } },
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 1 } },
      tokenUsageReceipts: {
        "session-1:17": true,
        "session-1:29": true,
      },
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    });

    expect(applyEligibleTurnUsage(migrated, event([17], 3_000), day)).toBe(migrated);
    expect(applyEligibleTurnUsage(migrated, event([29], 3_000), day)).toBe(migrated);
    expect(applyEligibleTurnUsage(migrated, event([20], 3_000), day)).toMatchObject({
      revision: 5,
      wallet: 2,
      tokenUsageWatermarks: { "session-1": 29 },
    });
    expect(migrated).not.toHaveProperty("tokenUsageReceipts");
  });

  it("fails loudly when a legacy multi-step turn is only partially receipted", () => {
    const migrated = hostStateSchema.parse({
      schemaVersion: 1,
      revision: 4,
      wallet: 1,
      lastGrantedLocalDate: null,
      daily: { [day]: { workCoins: 1 } },
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 1 } },
      tokenUsageReceipts: { "session-1:24": true },
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    });

    expect(() => applyEligibleTurnUsage(migrated, event([24, 29], 3_000), day))
      .toThrow(/partially receipted/i);
  });

  it("keeps replay state constant-size for repeated turns in one session", () => {
    let current = state();
    for (let seq = 1; seq <= 100; seq += 1) {
      current = applyEligibleTurnUsage(current, event([seq], 1), day);
    }

    expect(current.tokenUsageWatermarks).toEqual({ "session-1": 100 });
  });

  it.each([
    {
      label: "negative sequence",
      usageSeqs: [-1],
      stepUsages: [{ inputTokens: 0, outputTokens: 1 }],
    },
    {
      label: "mismatched step count",
      usageSeqs: [1, 2],
      stepUsages: [{ inputTokens: 0, outputTokens: 1 }],
    },
  ])("rejects an internally invalid eligible turn with $label", ({ usageSeqs, stepUsages }) => {
    expect(() => applyEligibleTurnUsage(state(), {
      ...event([1], 1),
      usageSeqs,
      stepUsages,
    } as unknown as EligibleTurnUsage, day)).toThrow(/usage sequences/i);
  });
});
