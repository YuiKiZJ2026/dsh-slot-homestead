import { z } from "zod";

const nonNegativeSafeInteger = z.number().int().nonnegative().safe();
const identifier = z.string().min(1).max(256);
const localDate = z.iso.date();
const usageSequenceKey = z.string().regex(/^(?:0|[1-9]\d*)$/);

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

export const tokenEnergyStateSchema = z
  .object({
    progress: nonNegativeSafeInteger.max(2_999),
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
  })
  .strict();
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
  settings: gameSettingsSchema,
  pendingSpin: pendingSpinSchema.nullable(),
  agentStatus: z.enum(["idle", "working"]),
  capabilities: z.object({ commands: z.literal(true) }).strict(),
} as const;

export const publicSnapshotSchema = z.object(publicSnapshotFields).strict();
export type PublicSnapshot = z.infer<typeof publicSnapshotSchema>;
const durableCommandSnapshotSchema = publicSnapshotSchema.omit({ agentStatus: true });
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
    tokenEnergy: tokenEnergyStateSchema,
    tokenUsageReceipts: z.record(identifier, z.literal(true)),
    pityCount: nonNegativeSafeInteger,
    inventory: z.array(identifier),
    displaySlots: z.array(identifier).max(12),
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
    tokenEnergy: tokenEnergyStateSchema,
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
    settings: gameSettingsSchema,
    pendingSpin: pendingSpinSchema.nullable(),
    recentCommands: z.record(z.uuid(), commandReceiptSchema),
  })
  .strict();

export type HostState = z.infer<typeof hostStateV2Schema>;

export const hostStateSchema = z
  .union([hostStateV2Schema, hostStateV1Schema])
  .transform((state): HostState => {
    if (state.schemaVersion === 2) return state;
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
  });

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
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Settings patch cannot be empty");

export const commandRequestSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("claimDaily") }).strict(),
  z.object({ ...commandBase, type: z.literal("insertCoin") }).strict(),
  z.object({ ...commandBase, type: z.literal("pullLever"), spinId: identifier }).strict(),
  z.object({ ...commandBase, type: z.literal("settleSpin"), spinId: identifier }).strict(),
  z.object({ ...commandBase, type: z.literal("buyItem"), itemId: identifier }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("setDisplay"),
      itemId: identifier,
      displayed: z.boolean(),
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
  | "locked-spin-reward"
  | "item-not-owned";

export type CommandResult =
  | { status: 200; snapshot: PublicSnapshot; errorCode?: never }
  | { status: 409; snapshot: PublicSnapshot; errorCode: CommandErrorCode };
