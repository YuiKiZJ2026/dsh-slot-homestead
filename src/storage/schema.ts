import { z } from "zod";
import { TABLE_POSITION_IDS } from "../domain/table-positions";
import { createInitialEcosystemState, type DateKey, type GameState } from "../domain/types";

const NonNegativeIntegerSchema = z.number().finite().int().nonnegative();
const IdentifierSchema = z.string().min(1);
const TimestampSchema = z.iso.datetime({ offset: true }).refine(
  hasSupportedCalendarYear,
  "Timestamp year must be between 1000 and 9999",
);
const DateKeySchema = z.custom<DateKey>(
  (value) => typeof value === "string" && isCalendarDateKey(value),
  "Invalid calendar date key",
);

const DailyLedgerSchema = z.strictObject({
  workCoins: NonNegativeIntegerSchema.max(25),
  focusMinutes: NonNegativeIntegerSchema,
  settledFocusHours: NonNegativeIntegerSchema,
  focusCoins: NonNegativeIntegerSchema.max(16),
});

const ResolvedRewardSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({
    kind: z.literal("coins"),
    amount: NonNegativeIntegerSchema,
    reason: z.enum(["refund", "five-coins", "pity-fallback", "robot-fallback"]),
  }),
  z.strictObject({
    kind: z.literal("collectible"),
    collectibleId: IdentifierSchema,
    isDuplicate: z.boolean(),
    conversionCoins: NonNegativeIntegerSchema,
    bonusCoins: NonNegativeIntegerSchema,
  }),
  z.strictObject({
    kind: z.literal("ecosystem-item"),
    itemId: IdentifierSchema,
    isDuplicate: z.boolean(),
    conversionCoins: NonNegativeIntegerSchema,
  }),
]);

const ReelSymbolSchema = z.enum(["coin", "leaf", "crystal", "moon", "robot"]);
const ResolvedSpinSchema = z.strictObject({
  id: IdentifierSchema,
  stage: z.enum(["coin-inserted", "spinning", "highlight", "payout", "settled"]),
  reels: z.tuple([ReelSymbolSchema, ReelSymbolSchema, ReelSymbolSchema]),
  reward: ResolvedRewardSchema,
  pityAfter: NonNegativeIntegerSchema,
  createdAt: TimestampSchema,
});

const PendingVerificationSchema = z.strictObject({
  eventId: IdentifierSchema,
  occurredAt: TimestampSchema,
});

const StringTimestampRecordSchema = safeRecord(IdentifierSchema, TimestampSchema);
const UniqueIdentifierArraySchema = z.array(IdentifierSchema).refine(
  (values) => new Set(values).size === values.length,
  "Expected unique identifiers",
);
const TablePlacementSchema = z.strictObject({
  itemId: IdentifierSchema,
  positionId: z.enum(TABLE_POSITION_IDS),
});
const TablePlacementsSchema = z.array(TablePlacementSchema).max(12).superRefine((placements, context) => {
  const items = new Set<string>();
  const positions = new Set<string>();
  for (const [index, placement] of placements.entries()) {
    if (items.has(placement.itemId)) {
      context.addIssue({ code: "custom", path: [index, "itemId"], message: "Expected unique item placements" });
    }
    if (positions.has(placement.positionId)) {
      context.addIssue({ code: "custom", path: [index, "positionId"], message: "Expected unique table positions" });
    }
    items.add(placement.itemId);
    positions.add(placement.positionId);
  }
});
const HabitatIdSchema = z.enum(["aquarium", "garden", "animals"]);
const LifecycleGrowthSchema = z.number().finite().min(0).max(100);
const NullableLifecycleTimestampSchema = TimestampSchema.nullable();
const EcosystemFishLifeSchema = z.strictObject({
  count: NonNegativeIntegerSchema,
  growth: LifecycleGrowthSchema,
  boostedUntil: NullableLifecycleTimestampSchema,
});
const EcosystemPlotLifeSchema = z.strictObject({
  seedId: IdentifierSchema.nullable(),
  growth: LifecycleGrowthSchema,
  readyYield: NonNegativeIntegerSchema.max(1),
  boostedUntil: NullableLifecycleTimestampSchema,
  generation: NonNegativeIntegerSchema,
});
const EcosystemLivestockLifeSchema = z.strictObject({
  adults: NonNegativeIntegerSchema,
  juveniles: NonNegativeIntegerSchema,
  juvenileGrowth: LifecycleGrowthSchema,
  production: LifecycleGrowthSchema,
  readyProducts: NonNegativeIntegerSchema.max(9),
  boostedUntil: NullableLifecycleTimestampSchema,
  generation: NonNegativeIntegerSchema,
});
const EcosystemLifecycleSchema = z.strictObject({
  lastSimulatedAt: NullableLifecycleTimestampSchema,
  fish: safeRecord(IdentifierSchema, EcosystemFishLifeSchema),
  plots: z.strictObject({
    "1": EcosystemPlotLifeSchema,
    "2": EcosystemPlotLifeSchema,
    "3": EcosystemPlotLifeSchema,
    "4": EcosystemPlotLifeSchema,
    "5": EcosystemPlotLifeSchema,
    "6": EcosystemPlotLifeSchema,
  }),
  livestock: safeRecord(IdentifierSchema, EcosystemLivestockLifeSchema),
  produce: safeRecord(IdentifierSchema, NonNegativeIntegerSchema),
});
const EcosystemStateSchema = z.strictObject({
  discovered: UniqueIdentifierArraySchema,
  selected: z.strictObject({
    aquarium: IdentifierSchema,
    garden: IdentifierSchema,
    animals: IdentifierSchema,
  }),
  supplies: z.strictObject({
    fishFeed: NonNegativeIntegerSchema.max(999),
    fertilizer: NonNegativeIntegerSchema.max(999),
    animalFeed: NonNegativeIntegerSchema.max(999),
  }),
  progress: z.record(HabitatIdSchema, NonNegativeIntegerSchema.max(100)),
  milestones: z.record(HabitatIdSchema, NonNegativeIntegerSchema),
  harmony: NonNegativeIntegerSchema.max(100),
  lifecycle: EcosystemLifecycleSchema.optional().transform(
    (value) => value ?? createInitialEcosystemState().lifecycle,
  ),
});

export const GameStateSchema: z.ZodType<GameState> = z.strictObject({
  schemaVersion: z.literal(1),
  revision: NonNegativeIntegerSchema,
  wallet: NonNegativeIntegerSchema,
  lastAwardDate: DateKeySchema.nullable(),
  dailyLedgers: safeRecord(DateKeySchema, DailyLedgerSchema),
  processedEvents: StringTimestampRecordSchema,
  completedTasks: StringTimestampRecordSchema,
  verifiedTasks: StringTimestampRecordSchema,
  pendingVerifications: safeRecord(IdentifierSchema, PendingVerificationSchema),
  pityMisses: NonNegativeIntegerSchema,
  ownedCollectibles: UniqueIdentifierArraySchema,
  displayedCollectibles: UniqueIdentifierArraySchema,
  tablePlacements: TablePlacementsSchema.optional().transform((placements) => placements ?? []),
  activeSpin: ResolvedSpinSchema.nullable(),
  agentStatus: z.enum(["idle", "working", "completed", "error"]),
  ecosystem: EcosystemStateSchema.optional().transform((value) => value ?? createInitialEcosystemState()),
  settings: z.strictObject({
    muted: z.boolean(),
    reducedMotion: z.boolean(),
    scale: z.union([z.literal(1), z.literal(2)]),
    companionScale: z.number().min(0.75).max(1.6).optional(),
  }),
});

export function parseGameState(input: unknown): GameState {
  return GameStateSchema.parse(input);
}

function isCalendarDateKey(value: string): value is DateKey {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isSupportedYear(year) || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1]!;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function hasSupportedCalendarYear(value: string): boolean {
  const year = Number(value.slice(0, 4));
  return isSupportedYear(year);
}

function isSupportedYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

function safeRecord<Key extends string, Value>(
  keySchema: z.ZodType<Key>,
  valueSchema: z.ZodType<Value>,
): z.ZodType<Record<Key, Value>> {
  return z.unknown().transform((input, context) => {
    if (!isRecordObject(input)) {
      context.addIssue({ code: "custom", message: "Expected a record object" });
      return z.NEVER;
    }

    const output = Object.create(null) as Record<Key, Value>;
    for (const key of Object.keys(input)) {
      const parsedKey = keySchema.safeParse(key);
      if (!parsedKey.success) {
        context.addIssue({ code: "custom", path: [key], message: "Invalid record key" });
        continue;
      }

      const parsedValue = valueSchema.safeParse(input[key]);
      if (!parsedValue.success) {
        context.addIssue({ code: "custom", path: [key], message: "Invalid record value" });
        continue;
      }

      Object.defineProperty(output, parsedKey.data, {
        configurable: true,
        enumerable: true,
        value: parsedValue.data,
        writable: true,
      });
    }

    return output;
  }) as z.ZodType<Record<Key, Value>>;
}

function isRecordObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}
