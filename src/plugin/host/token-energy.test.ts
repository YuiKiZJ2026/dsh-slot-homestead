import { describe, expect, it } from "vitest";
import { createInitialEcosystemState } from "../../domain/types";
import type { EligibleTurnUsage, HostState } from "../shared/contracts";
import { hostStateSchema } from "../shared/contracts";
import { actualTokenUsage, applyEligibleTurnUsage } from "./token-energy";

const day = "2026-08-26";

function state(overrides: Partial<HostState> = {}): HostState {
  return {
    schemaVersion: 4,
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
    ecosystem: createInitialEcosystemState(),
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

  it("counts the four authoritative provider fields and never adds reasoning twice", () => {
    expect(
      actualTokenUsage({
        inputTokens: 1_000,
        outputTokens: 2_500,
        cacheWriteTokens: 1_000,
        cacheReadTokens: 5_000,
        reasoningTokens: 2_000,
      }),
    ).toBe(9_500);
  });

  it("converts carried progress plus eligible usage into one coin", () => {
    const next = applyEligibleTurnUsage(
      state({ tokenEnergy: { progress: 9_800, dailyCoins: {} } }),
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

  it("credits every actual token and can award multiple coins for one large turn", () => {
    const next = applyEligibleTurnUsage(state(), event([18], 25_000), day);

    expect(next).toMatchObject({
      revision: 5,
      wallet: 2,
      daily: { [day]: { workCoins: 2 } },
      tokenEnergy: { progress: 5_000, dailyCoins: { [day]: 2 } },
    });
  });

  it("discards overflow progress when one large turn reaches the daily token cap", () => {
    const next = applyEligibleTurnUsage(
      state({
        wallet: 7,
        daily: { [day]: { workCoins: 7 } },
        tokenEnergy: { progress: 0, dailyCoins: { [day]: 7 } },
      }),
      event([181], 25_000),
      day,
    );

    expect(next).toMatchObject({
      wallet: 8,
      daily: { [day]: { workCoins: 8 } },
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 8 } },
      tokenUsageWatermarks: { "session-1": 181 },
    });
  });

  it("discards overflow progress when one large turn reaches the daily work cap", () => {
    const next = applyEligibleTurnUsage(
      state({
        wallet: 24,
        daily: { [day]: { workCoins: 24 } },
        tokenEnergy: { progress: 9_000, dailyCoins: { [day]: 4 } },
      }),
      event([182], 16_000),
      day,
    );

    expect(next).toMatchObject({
      wallet: 25,
      daily: { [day]: { workCoins: 25 } },
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 5 } },
      tokenUsageWatermarks: { "session-1": 182 },
    });
  });

  it.each([
    state({ tokenEnergy: { progress: 9_800, dailyCoins: { [day]: 8 } } }),
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
    const once = applyEligibleTurnUsage(state(), event([20], 10_000), day);
    const restarted = hostStateSchema.parse(JSON.parse(JSON.stringify(once)));
    const twice = applyEligibleTurnUsage(restarted, event([20], 10_000), day);

    expect(twice).toBe(restarted);
    expect(twice.wallet).toBe(1);
  });

  it("rejects a whole multi-step turn when any sequence is at or below the watermark", () => {
    const base = state({ tokenUsageWatermarks: { "session-1": 21 } });

    expect(applyEligibleTurnUsage(base, event([21, 22], 10_000), day)).toBe(base);
  });

  it("aggregates matching multi-step usages and advances to the final sequence", () => {
    const next = applyEligibleTurnUsage(state(), {
      ...event([24, 29], 0),
      stepUsages: [
        { inputTokens: 0, outputTokens: 4_000 },
        { inputTokens: 0, outputTokens: 6_000 },
      ],
    }, day);

    expect(next).toMatchObject({
      wallet: 1,
      tokenEnergy: { progress: 0, dailyCoins: { [day]: 1 } },
      tokenUsageWatermarks: { "session-1": 29 },
    });
  });

  it("migrates weighted v2 progress by replaying exact history without duplicating old coins", () => {
    const migrated = hostStateSchema.parse({
      schemaVersion: 2,
      revision: 59,
      wallet: 2,
      lastGrantedLocalDate: null,
      daily: {},
      tokenEnergy: { progress: 646, dailyCoins: {} },
      tokenUsageWatermarks: { "session-current": 45 },
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    });

    expect(migrated).toMatchObject({
      schemaVersion: 4,
      tokenEnergy: { progress: 0, dailyCoins: {} },
      tokenUsageWatermarks: {},
      legacyWeightedUsageWatermarks: { "session-current": 45 },
    });

    const replayed = applyEligibleTurnUsage(migrated, {
      sessionId: "session-current",
      turn: 2,
      usageSeqs: [45],
      stepUsages: [{ inputTokens: 6_333, outputTokens: 13 }],
      occurredAt: "2026-08-26T12:00:00+08:00",
    }, day);

    expect(replayed).toMatchObject({
      revision: 60,
      wallet: 2,
      tokenEnergy: { progress: 6_346, dailyCoins: {} },
      tokenUsageWatermarks: { "session-current": 45 },
    });
    expect(replayed).not.toHaveProperty("legacyWeightedUsageWatermarks");
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

    const firstReceipt = applyEligibleTurnUsage(migrated, event([17], 3_000), day);
    const recoveredHole = applyEligibleTurnUsage(firstReceipt, event([20], 7_000), day);
    const finalReceipt = applyEligibleTurnUsage(recoveredHole, event([29], 3_000), day);

    expect(finalReceipt).toMatchObject({
      revision: 7,
      wallet: 2,
      tokenEnergy: { progress: 3_000, dailyCoins: { [day]: 2 } },
      tokenUsageWatermarks: { "session-1": 29 },
    });
    expect(finalReceipt).not.toHaveProperty("legacyWeightedUsageWatermarks");
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
