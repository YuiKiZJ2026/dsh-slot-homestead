import type { EligibleTurnUsage, HostState, ReportedTokenUsage } from "../shared/contracts";

const TOKENS_PER_COIN = 10_000;
const DAILY_TOKEN_COIN_CAP = 8;
const DAILY_WORK_COIN_CAP = 25;

export function actualTokenUsage(usage: ReportedTokenUsage): number {
  const total = usage.inputTokens +
    usage.outputTokens +
    (usage.cacheWriteTokens ?? 0) +
    (usage.cacheReadTokens ?? 0);
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("Reported token usage total exceeds the safe integer range");
  }
  return total;
}

export function applyEligibleTurnUsage(
  state: HostState,
  event: EligibleTurnUsage,
  localDate: string,
): HostState {
  assertValidUsageSequences(event);
  const watermark = state.tokenUsageWatermarks[event.sessionId] ?? -1;
  if (event.usageSeqs.some((sequence) => sequence <= watermark)) return state;

  const legacyReceipts = state.legacyTokenUsageReceipts?.[event.sessionId];
  let isLegacyReplay = false;
  if (legacyReceipts !== undefined) {
    const receiptCount = event.usageSeqs.filter((sequence) =>
      legacyReceipts[String(sequence)] === true).length;
    if (receiptCount === event.usageSeqs.length) {
      isLegacyReplay = true;
    } else if (receiptCount !== 0) {
      throw new Error(
        `Legacy token usage turn for ${event.sessionId} is partially receipted`,
      );
    }
  } else {
    const legacyWatermark = state.legacyWeightedUsageWatermarks?.[event.sessionId];
    isLegacyReplay = legacyWatermark !== undefined &&
      event.usageSeqs[event.usageSeqs.length - 1] <= legacyWatermark;
  }

  const nextWatermarks = {
    ...state.tokenUsageWatermarks,
    [event.sessionId]: Math.max(
      watermark,
      event.usageSeqs[event.usageSeqs.length - 1],
    ),
  };

  const actual = event.stepUsages.reduce((total, usage) => {
    const next = total + actualTokenUsage(usage);
    if (!Number.isSafeInteger(next)) {
      throw new RangeError("Eligible turn token usage exceeds the safe integer range");
    }
    return next;
  }, 0);

  if (isLegacyReplay) {
    const { legacyWeightedUsageWatermarks: _legacyWatermarks, ...durableState } = state;
    return {
      ...durableState,
      revision: state.revision + 1,
      tokenEnergy: {
        ...state.tokenEnergy,
        progress: (state.tokenEnergy.progress + actual) % TOKENS_PER_COIN,
      },
      tokenUsageWatermarks: nextWatermarks,
      ...withoutCompletedLegacyWeightedWatermark(state, event),
    };
  }

  const tokenCoinsToday = state.tokenEnergy.dailyCoins[localDate] ?? 0;
  const workCoinsToday = state.daily[localDate]?.workCoins ?? 0;

  if (tokenCoinsToday >= DAILY_TOKEN_COIN_CAP || workCoinsToday >= DAILY_WORK_COIN_CAP) {
    return {
      ...state,
      revision: state.revision + 1,
      tokenUsageWatermarks: nextWatermarks,
    };
  }

  const totalProgress = state.tokenEnergy.progress + actual;
  const earnedCoins = Math.floor(totalProgress / TOKENS_PER_COIN);
  const awardedCoins = Math.min(
    earnedCoins,
    DAILY_TOKEN_COIN_CAP - tokenCoinsToday,
    DAILY_WORK_COIN_CAP - workCoinsToday,
  );
  const nextProgress = totalProgress % TOKENS_PER_COIN;

  return {
    ...state,
    revision: state.revision + 1,
    wallet: state.wallet + awardedCoins,
    daily:
      awardedCoins === 0
        ? state.daily
        : {
            ...state.daily,
            [localDate]: { workCoins: workCoinsToday + awardedCoins },
          },
    tokenEnergy: {
      progress: nextProgress,
      dailyCoins:
        awardedCoins === 0
          ? state.tokenEnergy.dailyCoins
          : { ...state.tokenEnergy.dailyCoins, [localDate]: tokenCoinsToday + awardedCoins },
    },
    tokenUsageWatermarks: nextWatermarks,
  };
}

function withoutCompletedLegacyWeightedWatermark(
  state: HostState,
  event: EligibleTurnUsage,
): { legacyWeightedUsageWatermarks?: Record<string, number> } {
  const legacyWatermarks = state.legacyWeightedUsageWatermarks;
  const sessionWatermark = legacyWatermarks?.[event.sessionId];
  const finalSequence = event.usageSeqs[event.usageSeqs.length - 1];
  if (legacyWatermarks === undefined || sessionWatermark === undefined ||
      finalSequence < sessionWatermark) {
    return legacyWatermarks === undefined
      ? {}
      : { legacyWeightedUsageWatermarks: legacyWatermarks };
  }
  const { [event.sessionId]: _completed, ...remaining } = legacyWatermarks;
  return Object.keys(remaining).length === 0
    ? {}
    : { legacyWeightedUsageWatermarks: remaining };
}

function assertValidUsageSequences(event: EligibleTurnUsage): void {
  if (
    event.usageSeqs.length === 0 ||
    event.usageSeqs.length !== event.stepUsages.length ||
    event.usageSeqs.some((sequence, index) =>
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      (index > 0 && sequence <= event.usageSeqs[index - 1]))
  ) {
    throw new TypeError(
      "Eligible turn usage sequences must be nonnegative, strictly increasing, and match steps",
    );
  }
}
