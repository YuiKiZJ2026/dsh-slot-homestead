import type { EligibleTurnUsage, HostState, ReportedTokenUsage } from "../shared/contracts";

const TOKENS_PER_COIN = 3_000;
const DAILY_TOKEN_COIN_CAP = 8;
const DAILY_WORK_COIN_CAP = 25;

export function weightedTokenUsage(usage: ReportedTokenUsage): number {
  return (
    usage.outputTokens +
    Math.floor(usage.inputTokens * 0.1) +
    Math.floor((usage.cacheWriteTokens ?? 0) * 0.1) +
    Math.floor((usage.cacheReadTokens ?? 0) * 0.02)
  );
}

export function applyEligibleTurnUsage(
  state: HostState,
  event: EligibleTurnUsage,
  localDate: string,
): HostState {
  assertValidUsageSequences(event);
  const watermark = state.tokenUsageWatermarks[event.sessionId] ?? -1;
  const legacyReceipts = state.legacyTokenUsageReceipts?.[event.sessionId];
  if (legacyReceipts !== undefined) {
    const receiptCount = event.usageSeqs.filter((sequence) =>
      legacyReceipts[String(sequence)] === true).length;
    if (receiptCount === event.usageSeqs.length) {
      return state;
    }
    if (receiptCount !== 0) {
      throw new Error(
        `Legacy token usage turn for ${event.sessionId} is partially receipted`,
      );
    }
  } else if (event.usageSeqs.some((sequence) => sequence <= watermark)) {
    return state;
  }

  const nextWatermarks = {
    ...state.tokenUsageWatermarks,
    [event.sessionId]: Math.max(
      watermark,
      event.usageSeqs[event.usageSeqs.length - 1],
    ),
  };

  const tokenCoinsToday = state.tokenEnergy.dailyCoins[localDate] ?? 0;
  const workCoinsToday = state.daily[localDate]?.workCoins ?? 0;

  if (tokenCoinsToday >= DAILY_TOKEN_COIN_CAP || workCoinsToday >= DAILY_WORK_COIN_CAP) {
    return {
      ...state,
      revision: state.revision + 1,
      tokenUsageWatermarks: nextWatermarks,
    };
  }

  const effective = event.stepUsages.reduce(
    (total, usage) => total + weightedTokenUsage(usage),
    0,
  );
  const credited = Math.min(TOKENS_PER_COIN, effective);
  const totalProgress = state.tokenEnergy.progress + credited;
  const awardedCoins = Math.floor(totalProgress / TOKENS_PER_COIN);
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
