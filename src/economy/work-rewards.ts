import type { DshEvent } from "../dsh/events";
import type { DailyLedger, DateKey, GameState } from "../domain/types";
import { localDateKey } from "../time/clock";
import { advanceEcosystemFromWork } from "../ecosystem/ecosystem";

const DAILY_AWARD = 3;
const WORK_COIN_CAP = 25;
const FOCUS_COIN_CAP = 16;
const FOCUS_MINUTE_CAP = 480;
const REWARD_WINDOW_DAYS = 7;
const RETENTION_WINDOW_DAYS = 30;

const EMPTY_LEDGER: DailyLedger = {
  workCoins: 0,
  focusMinutes: 0,
  settledFocusHours: 0,
  focusCoins: 0,
};

interface WorkRewardDependencies {
  nowDate: DateKey;
  verificationRoll: (eventId: string) => number;
}

export function applyDailyOpen(state: GameState, today: DateKey): GameState {
  const normalized = pruneExpiredRecords(state, today);

  if (normalized.lastAwardDate !== null && compareDateKeys(today, normalized.lastAwardDate) <= 0) {
    return normalized;
  }

  return {
    ...normalized,
    wallet: Math.max(0, normalized.wallet) + DAILY_AWARD,
    lastAwardDate: today,
  };
}

export function applyDshEvent(
  state: GameState,
  event: DshEvent,
  deps: { nowDate: DateKey; verificationRoll: (eventId: string) => number },
): GameState {
  if (event.type === "focus.minutes" && !isPositiveWholeMinuteCount(event.minutes)) {
    return state;
  }

  const eventDate = dateKeyFor(event.occurredAt);

  if (
    eventDate === null ||
    isAfter(deps.nowDate, eventDate) ||
    isOlderThan(deps.nowDate, eventDate, RETENTION_WINDOW_DAYS)
  ) {
    return state;
  }

  if (event.type === "agent.status") {
    if (hasOwn(state.processedEvents, event.id)) {
      return state;
    }

    return {
      ...state,
      agentStatus: event.status,
      processedEvents: { ...state.processedEvents, [event.id]: event.occurredAt },
    };
  }

  const normalized = pruneExpiredRecords(state, deps.nowDate);

  if (hasOwn(normalized.processedEvents, event.id)) {
    return normalized;
  }

  const processed = {
    ...normalized,
    processedEvents: { ...normalized.processedEvents, [event.id]: event.occurredAt },
  };
  const isRewardable = !isOlderThan(deps.nowDate, eventDate, REWARD_WINDOW_DAYS);

  switch (event.type) {
    case "task.completed":
      return applyTaskCompletion(processed, event, eventDate, isRewardable, deps);

    case "task.verified":
      return applyTaskVerification(processed, event, eventDate, isRewardable, deps);

    case "focus.minutes":
      return isRewardable ? applyFocusMinutes(processed, event, eventDate) : processed;
  }
}

function applyTaskCompletion(
  state: GameState,
  event: Extract<DshEvent, { type: "task.completed" }>,
  eventDate: DateKey,
  isRewardable: boolean,
  deps: WorkRewardDependencies,
): GameState {
  if (hasOwn(state.completedTasks, event.taskId)) {
    return state;
  }

  let next: GameState = {
    ...state,
    completedTasks: { ...state.completedTasks, [event.taskId]: event.occurredAt },
  };

  if (isRewardable) {
    next = awardWorkCoins(next, eventDate, 1);
  }

  const pending = next.pendingVerifications[event.taskId];

  if (pending === undefined || hasOwn(next.verifiedTasks, event.taskId)) {
    return next;
  }

  const pendingDate = dateKeyFor(pending.occurredAt);
  const { [event.taskId]: _resolved, ...remainingPending } = next.pendingVerifications;
  next = {
    ...next,
    pendingVerifications: remainingPending,
    verifiedTasks: { ...next.verifiedTasks, [event.taskId]: pending.occurredAt },
  };

  if (
    pendingDate !== null &&
    !isOlderThan(deps.nowDate, pendingDate, REWARD_WINDOW_DAYS) &&
    deps.verificationRoll(pending.eventId) < 0.3
  ) {
    next = awardWorkCoins(next, pendingDate, 1);
  }

  return next;
}

function applyTaskVerification(
  state: GameState,
  event: Extract<DshEvent, { type: "task.verified" }>,
  eventDate: DateKey,
  isRewardable: boolean,
  deps: WorkRewardDependencies,
): GameState {
  if (hasOwn(state.verifiedTasks, event.taskId)) {
    return state;
  }

  if (!hasOwn(state.completedTasks, event.taskId)) {
    if (hasOwn(state.pendingVerifications, event.taskId)) {
      return state;
    }

    return {
      ...state,
      pendingVerifications: {
        ...state.pendingVerifications,
        [event.taskId]: { eventId: event.id, occurredAt: event.occurredAt },
      },
    };
  }

  let next: GameState = {
    ...state,
    verifiedTasks: { ...state.verifiedTasks, [event.taskId]: event.occurredAt },
  };

  if (isRewardable && deps.verificationRoll(event.id) < 0.3) {
    next = awardWorkCoins(next, eventDate, 1);
  }

  return next;
}

function applyFocusMinutes(
  state: GameState,
  event: Extract<DshEvent, { type: "focus.minutes" }>,
  eventDate: DateKey,
): GameState {
  const ledger = state.dailyLedgers[eventDate] ?? EMPTY_LEDGER;
  const workCoins = clamp(ledger.workCoins, 0, WORK_COIN_CAP);
  const focusCoins = clamp(ledger.focusCoins, 0, FOCUS_COIN_CAP);
  const focusMinutes = Math.max(0, ledger.focusMinutes) + event.minutes;
  const settledFocusHours = clamp(ledger.settledFocusHours, 0, FOCUS_COIN_CAP / 2);
  const totalFullHours = Math.floor(Math.min(focusMinutes, FOCUS_MINUTE_CAP) / 60);
  const nextSettledFocusHours = Math.max(settledFocusHours, totalFullHours);
  const newFocusHours = nextSettledFocusHours - settledFocusHours;
  const reward = Math.min(
    newFocusHours * 2,
    FOCUS_COIN_CAP - focusCoins,
    WORK_COIN_CAP - workCoins,
  );

  const nextLedger: DailyLedger = {
    workCoins: workCoins + reward,
    focusMinutes,
    settledFocusHours: nextSettledFocusHours,
    focusCoins: focusCoins + reward,
  };

  return advanceEcosystemFromWork({
    ...state,
    wallet: Math.max(0, state.wallet) + reward,
    dailyLedgers: { ...state.dailyLedgers, [eventDate]: nextLedger },
  }, reward);
}

function awardWorkCoins(state: GameState, date: DateKey, requestedCoins: number): GameState {
  const ledger = state.dailyLedgers[date] ?? EMPTY_LEDGER;
  const workCoins = clamp(ledger.workCoins, 0, WORK_COIN_CAP);
  const awardedCoins = Math.min(Math.max(0, requestedCoins), WORK_COIN_CAP - workCoins);

  if (awardedCoins === 0) {
    return state;
  }

  return advanceEcosystemFromWork({
    ...state,
    wallet: Math.max(0, state.wallet) + awardedCoins,
    dailyLedgers: {
      ...state.dailyLedgers,
      [date]: { ...ledger, workCoins: workCoins + awardedCoins },
    },
  }, awardedCoins);
}

function pruneExpiredRecords(state: GameState, nowDate: DateKey): GameState {
  const dailyLedgers = pruneRecord(
    state.dailyLedgers,
    nowDate,
    REWARD_WINDOW_DAYS,
    (date) => date,
  );
  const processedEvents = pruneRecord(state.processedEvents, nowDate, RETENTION_WINDOW_DAYS);
  const completedTasks = pruneRecord(state.completedTasks, nowDate, RETENTION_WINDOW_DAYS);
  const verifiedTasks = pruneRecord(state.verifiedTasks, nowDate, RETENTION_WINDOW_DAYS);
  const pendingVerifications = pruneRecord(
    state.pendingVerifications,
    nowDate,
    RETENTION_WINDOW_DAYS,
    (_taskId, pending) => pending.occurredAt,
  );

  if (
    dailyLedgers === state.dailyLedgers &&
    processedEvents === state.processedEvents &&
    completedTasks === state.completedTasks &&
    verifiedTasks === state.verifiedTasks &&
    pendingVerifications === state.pendingVerifications
  ) {
    return state;
  }

  return {
    ...state,
    dailyLedgers,
    processedEvents,
    completedTasks,
    verifiedTasks,
    pendingVerifications,
  };
}

function pruneRecord<T>(
  record: Record<string, T>,
  nowDate: DateKey,
  maxAge: number,
  occurredAt: (key: string, value: T) => string = (_key, value) => value as string,
): Record<string, T> {
  let next: Record<string, T> | undefined;

  for (const [key, value] of Object.entries(record)) {
    const date = dateKeyFor(occurredAt(key, value));

    if (date === null || isOlderThan(nowDate, date, maxAge)) {
      next ??= { ...record };
      delete next[key];
    }
  }

  return next ?? record;
}

function dateKeyFor(value: string): DateKey | null {
  if (isCalendarDateKey(value)) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.valueOf()) ? null : localDateKey(date);
}

function compareDateKeys(left: DateKey, right: DateKey): number {
  return calendarDayNumber(left) - calendarDayNumber(right);
}

function isOlderThan(nowDate: DateKey, eventDate: DateKey, days: number): boolean {
  return compareDateKeys(nowDate, eventDate) > days;
}

function isAfter(nowDate: DateKey, eventDate: DateKey): boolean {
  return compareDateKeys(eventDate, nowDate) > 0;
}

function calendarDayNumber(date: DateKey): number {
  const [year, month, day] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function isCalendarDateKey(value: string): value is DateKey {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    return false;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isPositiveWholeMinuteCount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(record, key);
}
