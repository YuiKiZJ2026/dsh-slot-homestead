import { z } from "zod";
import { TABLE_POSITION_IDS } from "../../domain/table-positions";
import { createInitialEcosystemState } from "../../domain/types";

const nonNegativeSafeInteger = z.number().int().nonnegative().safe();
const identifier = z.string().min(1).max(256);
const localDate = z.iso.date();
const usageSequenceKey = z.string().regex(/^(?:0|[1-9]\d*)$/);
const tablePlacementSchema = z.object({
  itemId: identifier,
  positionId: z.enum(TABLE_POSITION_IDS),
}).strict();

export const reportedTokenUsageSchema = z
  .object({
    inputTokens: nonNegativeSafeInteger,
    outputTokens: nonNegativeSafeInteger,
    cacheWriteTokens: nonNegativeSafeInteger.optional(),
    cacheReadTokens: nonNegativeSafeInteger.optional(),
    reasoningTokens: nonNegativeSafeInteger.optional(),
  })
  .strict();

export type ReportedTokenUsage = z.infer<typeof reportedTokenUsageSchema>;

const legacyTokenEnergyStateSchema = z
  .object({
    progress: nonNegativeSafeInteger.max(2_999),
    dailyCoins: z.record(z.string(), nonNegativeSafeInteger),
  })
  .strict();

export const tokenEnergyStateSchema = z
  .object({
    progress: nonNegativeSafeInteger.max(9_999),
    dailyCoins: z.record(z.string(), nonNegativeSafeInteger),
  })
  .strict();

export type TokenEnergyState = z.infer<typeof tokenEnergyStateSchema>;

const dailyLedgerSchema = z.object({ workCoins: nonNegativeSafeInteger.max(25) }).strict();
const gameSettingsSchema = z
  .object({
    muted: z.boolean(),
    reducedMotion: z.boolean(),
    scale: z.union([z.literal(1), z.literal(2)]),
    companionScale: z.number().min(0.75).max(1.6).optional(),
  })
  .strict();
const lifecycleGrowth = z.number().finite().min(0).max(100);
const nullableLifecycleTimestamp = z.iso.datetime({ offset: true }).nullable();
const ecosystemFishLifeSchema = z.object({
  count: nonNegativeSafeInteger,
  growth: lifecycleGrowth,
  boostedUntil: nullableLifecycleTimestamp,
}).strict();
const ecosystemPlotLifeSchema = z.object({
  seedId: identifier.nullable(),
  growth: lifecycleGrowth,
  readyYield: nonNegativeSafeInteger.max(1),
  boostedUntil: nullableLifecycleTimestamp,
  generation: nonNegativeSafeInteger,
}).strict();
const ecosystemLivestockLifeSchema = z.object({
  adults: nonNegativeSafeInteger,
  juveniles: nonNegativeSafeInteger,
  juvenileGrowth: lifecycleGrowth,
  production: lifecycleGrowth,
  readyProducts: nonNegativeSafeInteger.max(9),
  boostedUntil: nullableLifecycleTimestamp,
  generation: nonNegativeSafeInteger,
}).strict();
const ecosystemLifecycleSchema = z.object({
  lastSimulatedAt: nullableLifecycleTimestamp,
  fish: z.record(identifier, ecosystemFishLifeSchema),
  plots: z.object({
    "1": ecosystemPlotLifeSchema,
    "2": ecosystemPlotLifeSchema,
    "3": ecosystemPlotLifeSchema,
    "4": ecosystemPlotLifeSchema,
    "5": ecosystemPlotLifeSchema,
    "6": ecosystemPlotLifeSchema,
  }).strict(),
  livestock: z.record(identifier, ecosystemLivestockLifeSchema),
  produce: z.record(identifier, nonNegativeSafeInteger),
}).strict();
const ecosystemStateSchema = z.object({
  discovered: z.array(identifier).refine((items) => new Set(items).size === items.length),
  selected: z.object({
    aquarium: identifier,
    garden: identifier,
    animals: identifier,
  }).strict(),
  supplies: z.object({
    fishFeed: nonNegativeSafeInteger.max(999),
    fertilizer: nonNegativeSafeInteger.max(999),
    animalFeed: nonNegativeSafeInteger.max(999),
  }).strict(),
  progress: z.object({
    aquarium: nonNegativeSafeInteger.max(100),
    garden: nonNegativeSafeInteger.max(100),
    animals: nonNegativeSafeInteger.max(100),
  }).strict(),
  milestones: z.object({
    aquarium: nonNegativeSafeInteger,
    garden: nonNegativeSafeInteger,
    animals: nonNegativeSafeInteger,
  }).strict(),
  harmony: nonNegativeSafeInteger.max(100),
  lifecycle: ecosystemLifecycleSchema.optional().transform(
    (value) => value ?? createInitialEcosystemState().lifecycle,
  ),
}).strict();
const reelSymbolSchema = z.enum(["coin", "leaf", "crystal", "moon", "robot"]);
const rewardSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      kind: z.literal("coins"),
      amount: nonNegativeSafeInteger,
      reason: z.enum(["refund", "five-coins", "pity-fallback", "robot-fallback"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("collectible"),
      collectibleId: identifier,
      isDuplicate: z.boolean(),
      conversionCoins: nonNegativeSafeInteger,
      bonusCoins: nonNegativeSafeInteger,
    })
    .strict(),
  z
    .object({
      kind: z.literal("ecosystem-item"),
      itemId: identifier,
      isDuplicate: z.boolean(),
      conversionCoins: nonNegativeSafeInteger,
    })
    .strict(),
]);
export const pendingSpinSchema = z
  .object({
    id: identifier,
    stage: z.enum(["paid", "spinning"]),
    reels: z.tuple([reelSymbolSchema, reelSymbolSchema, reelSymbolSchema]),
    reward: rewardSchema,
    pityAfter: nonNegativeSafeInteger,
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const publicSnapshotFields = {
  revision: nonNegativeSafeInteger,
  wallet: nonNegativeSafeInteger,
  localDate,
  lastGrantedLocalDate: localDate.nullable(),
  daily: z.record(localDate, dailyLedgerSchema),
  tokenEnergy: tokenEnergyStateSchema,
  pityCount: nonNegativeSafeInteger,
  inventory: z.array(identifier),
  displaySlots: z.array(identifier).max(12),
  tablePlacements: z.array(tablePlacementSchema).max(12).optional(),
  ecosystem: ecosystemStateSchema,
  settings: gameSettingsSchema,
  pendingSpin: pendingSpinSchema.nullable(),
  agentStatus: z.enum(["idle", "working"]),
  capabilities: z.object({ commands: z.literal(true) }).strict(),
} as const;

export const publicSnapshotSchema = z.object(publicSnapshotFields).strict();
export type PublicSnapshot = z.infer<typeof publicSnapshotSchema>;
const durableCommandSnapshotSchema = publicSnapshotSchema
  .omit({ agentStatus: true, ecosystem: true })
  .extend({
    ecosystem: ecosystemStateSchema.optional().transform(
      (value) => value ?? createInitialEcosystemState(),
    ),
  })
  .strict();
type DurableCommandSnapshot = z.infer<typeof durableCommandSnapshotSchema>;

const commandReceiptSchema = z
  .object({
    fingerprint: z.string().min(1),
    issuedAt: z.iso.datetime({ offset: true }),
    snapshot: durableCommandSnapshotSchema,
  })
  .strict();

const hostStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    revision: nonNegativeSafeInteger,
    wallet: nonNegativeSafeInteger,
    lastGrantedLocalDate: localDate.nullable(),
    daily: z.record(localDate, dailyLedgerSchema),
    tokenEnergy: legacyTokenEnergyStateSchema,
    tokenUsageReceipts: z.record(identifier, z.literal(true)),
    pityCount: nonNegativeSafeInteger,
    inventory: z.array(identifier),
    displaySlots: z.array(identifier).max(12),
    tablePlacements: z.array(tablePlacementSchema).max(12).optional(),
    settings: gameSettingsSchema,
    pendingSpin: pendingSpinSchema.nullable(),
    recentCommands: z.record(z.uuid(), commandReceiptSchema),
  })
  .strict();

export const hostStateV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    revision: nonNegativeSafeInteger,
    wallet: nonNegativeSafeInteger,
    lastGrantedLocalDate: localDate.nullable(),
    daily: z.record(localDate, dailyLedgerSchema),
    tokenEnergy: legacyTokenEnergyStateSchema,
    tokenUsageWatermarks: z.record(identifier, nonNegativeSafeInteger),
    // Present only for sessions migrated from v1. A cold/disposed session can
    // retain its exact group across bootstrap until its first authoritative
    // resume replay; new v2 state never appends legacy receipts.
    legacyTokenUsageReceipts: z
      .record(identifier, z.record(usageSequenceKey, z.literal(true)))
      .optional(),
    pityCount: nonNegativeSafeInteger,
    inventory: z.array(identifier),
    displaySlots: z.array(identifier).max(12),
    tablePlacements: z.array(tablePlacementSchema).max(12).optional(),
    settings: gameSettingsSchema,
    pendingSpin: pendingSpinSchema.nullable(),
    recentCommands: z.record(z.uuid(), commandReceiptSchema),
  })
  .strict();

export const hostStateV3Schema = z
  .object({
    schemaVersion: z.literal(3),
    revision: nonNegativeSafeInteger,
    wallet: nonNegativeSafeInteger,
    lastGrantedLocalDate: localDate.nullable(),
    daily: z.record(localDate, dailyLedgerSchema),
    tokenEnergy: tokenEnergyStateSchema,
    tokenUsageWatermarks: z.record(identifier, nonNegativeSafeInteger),
    // Temporary replay marker used only while upgrading weighted v2 progress
    // to exact provider-reported tokens. Replayed history reconstructs the
    // remainder without awarding the already-accounted historical coins.
    legacyWeightedUsageWatermarks: z
      .record(identifier, nonNegativeSafeInteger)
      .optional(),
    legacyTokenUsageReceipts: z
      .record(identifier, z.record(usageSequenceKey, z.literal(true)))
      .optional(),
    pityCount: nonNegativeSafeInteger,
    inventory: z.array(identifier),
    displaySlots: z.array(identifier).max(12),
    tablePlacements: z.array(tablePlacementSchema).max(12).optional(),
    settings: gameSettingsSchema,
    pendingSpin: pendingSpinSchema.nullable(),
    recentCommands: z.record(z.uuid(), commandReceiptSchema),
  })
  .strict();

export const hostStateV4Schema = hostStateV3Schema.extend({
  schemaVersion: z.literal(4),
  ecosystem: ecosystemStateSchema,
}).strict();

export type HostState = z.infer<typeof hostStateV4Schema>;

export const hostStateSchema = z
  .union([hostStateV4Schema, hostStateV3Schema, hostStateV2Schema, hostStateV1Schema])
  .transform((state): HostState => {
    if (state.schemaVersion === 4) return state;
    const v3 = state.schemaVersion === 3
      ? state
      : migrateV2ToV3(state.schemaVersion === 2 ? state : migrateV1ToV2(state));
    return migrateV3ToV4(v3);
  });

function migrateV1ToV2(state: z.infer<typeof hostStateV1Schema>): z.infer<typeof hostStateV2Schema> {
  const { tokenUsageReceipts, ...legacy } = state;
  const replay = migrateUsageReplay(tokenUsageReceipts);
  return {
    ...legacy,
    schemaVersion: 2,
    tokenUsageWatermarks: replay.watermarks,
    ...(Object.keys(replay.receipts).length === 0
      ? {}
      : { legacyTokenUsageReceipts: replay.receipts }),
  };
}

function migrateV2ToV3(state: z.infer<typeof hostStateV2Schema>): z.infer<typeof hostStateV3Schema> {
    const { tokenUsageWatermarks, tokenEnergy, ...legacy } = state;
    return {
      ...legacy,
      schemaVersion: 3,
      tokenEnergy: { progress: 0, dailyCoins: tokenEnergy.dailyCoins },
      tokenUsageWatermarks: {},
      ...(Object.keys(tokenUsageWatermarks).length === 0
        ? {}
        : { legacyWeightedUsageWatermarks: tokenUsageWatermarks }),
    };
}

function migrateV3ToV4(state: z.infer<typeof hostStateV3Schema>): HostState {
  return {
    ...state,
    schemaVersion: 4,
    ecosystem: createInitialEcosystemState(),
  };
}

function migrateUsageReplay(
  receipts: Record<string, true>,
): {
  watermarks: Record<string, number>;
  receipts: Record<string, Record<string, true>>;
} {
  const watermarks = new Map<string, number>();
  const validReceipts = new Map<string, Map<string, true>>();
  for (const key of Object.keys(receipts)) {
    const separator = key.lastIndexOf(":");
    if (separator <= 0) continue;
    const sessionId = key.slice(0, separator);
    const sequenceText = key.slice(separator + 1);
    if (!/^(?:0|[1-9]\d*)$/.test(sequenceText) || !identifier.safeParse(sessionId).success) {
      continue;
    }
    const sequence = Number(sequenceText);
    if (!Number.isSafeInteger(sequence) || sequence < 0) continue;
    const sessionReceipts = validReceipts.get(sessionId) ?? new Map<string, true>();
    sessionReceipts.set(sequenceText, true);
    validReceipts.set(sessionId, sessionReceipts);
    watermarks.set(sessionId, Math.max(watermarks.get(sessionId) ?? -1, sequence));
  }
  return {
    watermarks: Object.fromEntries(watermarks),
    receipts: Object.fromEntries(
      [...validReceipts].map(([sessionId, sessionReceipts]) => [
        sessionId,
        Object.fromEntries(sessionReceipts),
      ]),
    ),
  };
}

export interface EligibleTurnUsage {
  sessionId: string;
  turn: number;
  usageSeqs: readonly [number, ...number[]];
  stepUsages: readonly [ReportedTokenUsage, ...ReportedTokenUsage[]];
  occurredAt: string;
}

const commandBase = {
  commandId: z.uuid(),
  sessionId: identifier,
  expectedRevision: nonNegativeSafeInteger,
  issuedAt: z.iso.datetime({ offset: true }),
} as const;

const settingsPatchSchema = z
  .object({
    muted: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    scale: z.union([z.literal(1), z.literal(2)]).optional(),
    companionScale: z.number().min(0.75).max(1.6).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Settings patch cannot be empty");

export const commandRequestSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("claimDaily") }).strict(),
  z.object({ ...commandBase, type: z.literal("insertCoin") }).strict(),
  z.object({ ...commandBase, type: z.literal("pullLever"), spinId: identifier }).strict(),
  z.object({ ...commandBase, type: z.literal("settleSpin"), spinId: identifier }).strict(),
  z.object({ ...commandBase, type: z.literal("buyItem"), itemId: identifier }).strict(),
  z.object({
    ...commandBase,
    type: z.literal("careHabitat"),
    habitat: z.enum(["aquarium", "garden", "animals"]),
  }).strict(),
  z.object({
    ...commandBase,
    type: z.literal("collectHabitat"),
    habitat: z.enum(["garden", "animals"]),
  }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("setDisplay"),
      itemId: identifier,
      displayed: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("setPlacement"),
      itemId: identifier,
      positionId: z.enum(TABLE_POSITION_IDS).nullable(),
    })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("updateSettings"), patch: settingsPatchSchema })
    .strict(),
]);

export type CommandRequest = z.infer<typeof commandRequestSchema>;
export type CommandErrorCode =
  | "revision-conflict"
  | "command-id-reused"
  | "command-expired"
  | "clock-skew"
  | "insufficient-coins"
  | "invalid-spin-state"
  | "unknown-item"
  | "already-owned"
  | "no-supply"
  | "nothing-to-collect"
  | "locked-spin-reward"
  | "item-not-owned"
  | "position-occupied";

export type CommandResult =
  | { status: 200; snapshot: PublicSnapshot; errorCode?: never }
  | { status: 409; snapshot: PublicSnapshot; errorCode: CommandErrorCode };
