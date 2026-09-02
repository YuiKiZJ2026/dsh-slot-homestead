import { describe, expect, it } from "vitest";
import {
  commandRequestSchema,
  hostStateSchema,
  reportedTokenUsageSchema,
  tokenEnergyStateSchema,
} from "./contracts";

describe("reported token usage contract", () => {
  it("accepts non-negative safe integer token fields and optional zero-valued fields", () => {
    expect(
      reportedTokenUsageSchema.parse({ inputTokens: 0, outputTokens: 1 }),
    ).toEqual({ inputTokens: 0, outputTokens: 1 });
  });

  it.each([
    { inputTokens: -1, outputTokens: 0 },
    { inputTokens: 0.5, outputTokens: 0 },
    { inputTokens: Number.MAX_SAFE_INTEGER + 1, outputTokens: 0 },
    { inputTokens: 0, outputTokens: Number.NaN },
    { inputTokens: 0, outputTokens: 0, unexpected: 1 },
  ])("rejects invalid reported token usage %#", (usage) => {
    expect(() => reportedTokenUsageSchema.parse(usage)).toThrow();
  });
});

describe("token energy state contract", () => {
  it.each([0, 9_999])("accepts progress within the token remainder range: %i", (progress) => {
    expect(tokenEnergyStateSchema.parse({ progress, dailyCoins: {} }).progress).toBe(progress);
  });

  it.each([-1, 10_000, 0.5])("rejects progress outside the token remainder range: %i", (progress) => {
    expect(() => tokenEnergyStateSchema.parse({ progress, dailyCoins: {} })).toThrow();
  });
});

describe("authoritative host contracts", () => {
  it("migrates v1 token receipts to the highest valid final sequence per session", () => {
    const migrated = hostStateSchema.parse({
      schemaVersion: 1,
      revision: 9,
      wallet: 2,
      lastGrantedLocalDate: null,
      daily: {},
      tokenEnergy: { progress: 700, dailyCoins: {} },
      tokenUsageReceipts: {
        "session-a:3": true,
        "session-a:17": true,
        "workspace:session-b:4": true,
        "session-b:not-a-seq": true,
        "missing-seq": true,
        ":5": true,
        "session-c:9007199254740992": true,
      },
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    });

    expect(migrated).toMatchObject({
      schemaVersion: 4,
      revision: 9,
      tokenEnergy: { progress: 0, dailyCoins: {} },
      tokenUsageWatermarks: {},
      legacyWeightedUsageWatermarks: {
        "session-a": 17,
        "workspace:session-b": 4,
      },
      legacyTokenUsageReceipts: {
        "session-a": { "3": true, "17": true },
        "workspace:session-b": { "4": true },
      },
      ecosystem: {
        discovered: ["goldfish", "carrot-seed", "chick"],
        harmony: 0,
        lifecycle: {
          lastSimulatedAt: null,
          fish: { goldfish: { count: 1, growth: 0 } },
          plots: { "1": { seedId: "carrot-seed", readyYield: 0 } },
          livestock: { chick: { adults: 0, juveniles: 1 } },
          produce: {},
        },
      },
    });
    expect(migrated).not.toHaveProperty("tokenUsageReceipts");
  });

  it("upgrades legacy command receipts whose durable snapshots predate the ecosystem", () => {
    const commandId = "00000000-0000-4000-8000-000000000901";
    const migrated = hostStateSchema.parse({
      schemaVersion: 1,
      revision: 1,
      wallet: 3,
      lastGrantedLocalDate: "2026-08-26",
      daily: { "2026-08-26": { workCoins: 0 } },
      tokenEnergy: { progress: 0, dailyCoins: {} },
      tokenUsageReceipts: {},
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {
        [commandId]: {
          fingerprint: '["session-1","claimDaily"]',
          issuedAt: "2026-08-26T04:00:00.000Z",
          snapshot: {
            revision: 1,
            wallet: 3,
            localDate: "2026-08-26",
            lastGrantedLocalDate: "2026-08-26",
            daily: { "2026-08-26": { workCoins: 0 } },
            tokenEnergy: { progress: 0, dailyCoins: {} },
            pityCount: 0,
            inventory: [],
            displaySlots: [],
            settings: { muted: true, reducedMotion: false, scale: 1 },
            pendingSpin: null,
            capabilities: { commands: true },
          },
        },
      },
    });

    expect(migrated.recentCommands[commandId]?.snapshot.ecosystem.lifecycle.lastSimulatedAt)
      .toBeNull();
  });

  it("rejects unknown persisted state fields", () => {
    const state = {
      schemaVersion: 1,
      revision: 0,
      wallet: 0,
      lastGrantedLocalDate: null,
      daily: {},
      tokenEnergy: { progress: 0, dailyCoins: {} },
      tokenUsageReceipts: {},
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
      unexpected: true,
    };

    expect(() => hostStateSchema.parse(state)).toThrow();
  });

  it("rejects impossible persisted local calendar dates", () => {
    const state = {
      schemaVersion: 1,
      revision: 0,
      wallet: 0,
      lastGrantedLocalDate: "2026-02-30",
      daily: {},
      tokenEnergy: { progress: 0, dailyCoins: {} },
      tokenUsageReceipts: {},
      pityCount: 0,
      inventory: [],
      displaySlots: [],
      settings: { muted: true, reducedMotion: false, scale: 1 },
      pendingSpin: null,
      recentCommands: {},
    };

    expect(() => hostStateSchema.parse(state)).toThrow();
  });

  const common = {
    commandId: "a70e544f-4a14-4bb5-9e52-63ca95607d0a",
    sessionId: "session-1",
    expectedRevision: 4,
    issuedAt: "2026-08-26T04:00:00.000Z",
  };

  it.each([
    { ...common, type: "claimDaily" },
    { ...common, type: "insertCoin" },
    { ...common, type: "pullLever", spinId: "spin-1" },
    { ...common, type: "settleSpin", spinId: "spin-1" },
    { ...common, type: "buyItem", itemId: "plant" },
    { ...common, type: "careHabitat", habitat: "aquarium" },
    { ...common, type: "collectHabitat", habitat: "garden" },
    { ...common, type: "collectHabitat", habitat: "animals" },
    { ...common, type: "setDisplay", itemId: "plant", displayed: true },
    { ...common, type: "setPlacement", itemId: "plant", positionId: "left-front-round" },
    { ...common, type: "setPlacement", itemId: "plant", positionId: null },
    { ...common, type: "updateSettings", patch: { muted: false, scale: 2 } },
  ])("accepts the strict $type command variant", (request) => {
    expect(commandRequestSchema.parse(request)).toEqual(request);
    expect(() => commandRequestSchema.parse({ ...request, unexpected: true })).toThrow();
  });

  it("rejects a table position that is not one of the twelve scene surfaces", () => {
    expect(() => commandRequestSchema.parse({
      ...common,
      type: "setPlacement",
      itemId: "plant",
      positionId: "outside-the-table",
    })).toThrow();
  });

  it("accepts and bounds the persisted desktop companion scale", () => {
    expect(commandRequestSchema.parse({
      ...common,
      type: "updateSettings",
      patch: { companionScale: 1.25 },
    })).toMatchObject({ patch: { companionScale: 1.25 } });
    expect(commandRequestSchema.safeParse({
      ...common,
      type: "updateSettings",
      patch: { companionScale: 1.7 },
    }).success).toBe(false);
  });
});
