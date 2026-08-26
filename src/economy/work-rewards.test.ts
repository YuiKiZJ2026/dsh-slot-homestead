import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { applyDailyOpen, applyDshEvent } from "./work-rewards";

const day = "2026-08-26" as const;
const deps = { nowDate: day, verificationRoll: () => 0.1 };

describe("work rewards", () => {
  it("grants daily three once and outside the work cap", () => {
    const first = applyDailyOpen(createInitialState(), day);
    const second = applyDailyOpen(first, day);

    expect(first.wallet).toBe(3);
    expect(first.dailyLedgers[day]?.workCoins ?? 0).toBe(0);
    expect(second.wallet).toBe(3);
  });

  it("grants one coin for a unique completed task", () => {
    const event = {
      id: "event-1",
      taskId: "task-1",
      type: "task.completed" as const,
      occurredAt: "2026-08-26T09:00:00+08:00",
    };

    const once = applyDshEvent(createInitialState(), event, deps);
    const twice = applyDshEvent(once, event, deps);

    expect(once.wallet).toBe(1);
    expect(twice.wallet).toBe(1);
  });

  it("queues an early verification and awards it once after completion", () => {
    const verified = {
      id: "verify-1",
      taskId: "task-1",
      type: "task.verified" as const,
      occurredAt: "2026-08-26T09:01:00+08:00",
    };
    const completed = {
      id: "complete-1",
      taskId: "task-1",
      type: "task.completed" as const,
      occurredAt: "2026-08-26T09:02:00+08:00",
    };

    const queued = applyDshEvent(createInitialState(), verified, deps);
    const resolved = applyDshEvent(queued, completed, deps);

    expect(queued.wallet).toBe(0);
    expect(resolved.wallet).toBe(2);
    expect(resolved.verifiedTasks["task-1"]).toBeDefined();
  });

  it("awards two coins per full hour, clips to sixteen focus coins", () => {
    const focus = {
      id: "focus-1",
      type: "focus.minutes" as const,
      occurredAt: "2026-08-26T10:00:00+08:00",
      minutes: 540,
    };

    const state = applyDshEvent(createInitialState(), focus, deps);

    expect(state.wallet).toBe(16);
    expect(state.dailyLedgers[day].focusMinutes).toBe(540);
    expect(state.dailyLedgers[day].settledFocusHours).toBe(8);
  });

  it("clips a two-coin focus hour to one at work total 24 of 25", () => {
    const base = createInitialState();
    base.dailyLedgers[day] = {
      workCoins: 24,
      focusMinutes: 0,
      settledFocusHours: 0,
      focusCoins: 0,
    };
    const event = {
      id: "focus-clip",
      type: "focus.minutes" as const,
      occurredAt: "2026-08-26T11:00:00+08:00",
      minutes: 60,
    };

    const next = applyDshEvent(base, event, deps);

    expect(next.wallet).toBe(1);
    expect(next.dailyLedgers[day]).toMatchObject({
      workCoins: 25,
      settledFocusHours: 1,
      focusCoins: 1,
    });
  });

  it("does not grant a new daily award after clock rollback", () => {
    const future = applyDailyOpen(createInitialState(), "2026-08-28");
    const rollback = applyDailyOpen(future, "2026-08-27");

    expect(rollback.wallet).toBe(3);
    expect(rollback.lastAwardDate).toBe("2026-08-28");
  });

  it("caps combined work rewards at twenty-five", () => {
    let state = createInitialState();

    for (let index = 0; index < 26; index += 1) {
      state = applyDshEvent(
        state,
        {
          id: `event-${index}`,
          taskId: `task-${index}`,
          type: "task.completed",
          occurredAt: "2026-08-26T09:00:00+08:00",
        },
        deps,
      );
    }

    expect(state.wallet).toBe(25);
    expect(state.dailyLedgers[day].workCoins).toBe(25);
  });

  it("records but does not reward a completed task older than seven days", () => {
    const event = {
      id: "old-event",
      taskId: "old-task",
      type: "task.completed" as const,
      occurredAt: "2026-08-18T09:00:00+08:00",
    };

    const state = applyDshEvent(createInitialState(), event, deps);

    expect(state.wallet).toBe(0);
    expect(state.processedEvents["old-event"]).toBeDefined();
    expect(state.completedTasks["old-task"]).toBeDefined();
  });

  it("does not retain events older than the thirty-day idempotency window", () => {
    const event = {
      id: "expired-event",
      taskId: "expired-task",
      type: "task.completed" as const,
      occurredAt: "2026-07-26T09:00:00+08:00",
    };

    const state = applyDshEvent(createInitialState(), event, deps);

    expect(state.wallet).toBe(0);
    expect(state.processedEvents["expired-event"]).toBeUndefined();
    expect(state.completedTasks["expired-task"]).toBeUndefined();
  });

  it("rejects a future-dated reward event without retaining its IDs", () => {
    const state = createInitialState();
    const event = {
      id: "future-event",
      taskId: "future-task",
      type: "task.completed" as const,
      occurredAt: "2027-01-01T09:00:00+08:00",
    };

    const result = applyDshEvent(state, event, deps);

    expect(result).toBe(state);
    expect(result.wallet).toBe(0);
    expect(result.processedEvents["future-event"]).toBeUndefined();
    expect(result.completedTasks["future-task"]).toBeUndefined();
  });

  it("records a second event for a completed task without rewarding the task twice", () => {
    const first = {
      id: "complete-first",
      taskId: "same-task",
      type: "task.completed" as const,
      occurredAt: "2026-08-26T09:00:00+08:00",
    };
    const replayWithNewId = { ...first, id: "complete-second" };

    const once = applyDshEvent(createInitialState(), first, deps);
    const twice = applyDshEvent(once, replayWithNewId, deps);

    expect(twice.wallet).toBe(1);
    expect(twice.processedEvents["complete-first"]).toBeDefined();
    expect(twice.processedEvents["complete-second"]).toBeDefined();
    expect(twice.completedTasks["same-task"]).toBe(once.completedTasks["same-task"]);
  });

  it("keeps one pending verification per task when different verification IDs arrive", () => {
    const first = {
      id: "verify-first",
      taskId: "verified-once",
      type: "task.verified" as const,
      occurredAt: "2026-08-26T09:00:00+08:00",
    };
    const second = { ...first, id: "verify-second" };
    const completion = {
      id: "complete-verified-once",
      taskId: "verified-once",
      type: "task.completed" as const,
      occurredAt: "2026-08-26T09:02:00+08:00",
    };

    const queued = applyDshEvent(
      applyDshEvent(createInitialState(), first, deps),
      second,
      deps,
    );
    const resolved = applyDshEvent(queued, completion, deps);

    expect(queued.pendingVerifications["verified-once"]?.eventId).toBe("verify-first");
    expect(queued.processedEvents["verify-second"]).toBeDefined();
    expect(resolved.wallet).toBe(2);
    expect(resolved.pendingVerifications["verified-once"]).toBeUndefined();
  });

  it("uses the event local date instead of the processing date for work rewards", () => {
    const occurredAt = "2026-08-26T00:30:00+08:00";
    const nativeDate = new Date(occurredAt);
    const eventDate = `${nativeDate.getFullYear()}-${String(nativeDate.getMonth() + 1).padStart(2, "0")}-${String(nativeDate.getDate()).padStart(2, "0")}`;
    const event = {
      id: "local-date-event",
      taskId: "local-date-task",
      type: "task.completed" as const,
      occurredAt,
    };

    const state = applyDshEvent(createInitialState(), event, {
      ...deps,
      nowDate: "2026-08-27",
    });

    expect(state.dailyLedgers[eventDate]?.workCoins).toBe(1);
    expect(state.dailyLedgers["2026-08-27"]).toBeUndefined();
  });

  it("ignores focus events whose minutes are not positive safe integers", () => {
    const invalidMinutes = [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY];

    for (const minutes of invalidMinutes) {
      const state = createInitialState();
      const result = applyDshEvent(
        state,
        {
          id: `invalid-focus-${String(minutes)}`,
          type: "focus.minutes",
          occurredAt: "2026-08-26T10:00:00+08:00",
          minutes,
        },
        deps,
      );

      expect(result).toBe(state);
    }
  });

  it("enforces the sixteen-coin focus sub-cap independently of the work cap", () => {
    const base = createInitialState();
    base.dailyLedgers[day] = {
      workCoins: 15,
      focusMinutes: 420,
      settledFocusHours: 7,
      focusCoins: 15,
    };

    const state = applyDshEvent(
      base,
      {
        id: "focus-sub-cap",
        type: "focus.minutes",
        occurredAt: "2026-08-26T10:00:00+08:00",
        minutes: 60,
      },
      deps,
    );

    expect(state.wallet).toBe(1);
    expect(state.dailyLedgers[day]).toMatchObject({
      workCoins: 16,
      focusMinutes: 480,
      settledFocusHours: 8,
      focusCoins: 16,
    });
  });

  it("records agent status without changing reward state", () => {
    const state = applyDshEvent(
      createInitialState(),
      {
        id: "status-event",
        type: "agent.status",
        occurredAt: "2026-08-26T10:00:00+08:00",
        status: "working",
      },
      deps,
    );

    expect(state.agentStatus).toBe("working");
    expect(state.wallet).toBe(0);
    expect(state.dailyLedgers).toEqual({});
    expect(state.processedEvents["status-event"]).toBeDefined();
  });

  it("preserves otherwise-prunable reward records when recording agent status", () => {
    const state = createInitialState();
    state.dailyLedgers["2026-07-01"] = {
      workCoins: 5,
      focusMinutes: 180,
      settledFocusHours: 3,
      focusCoins: 5,
    };
    state.processedEvents["old-event"] = "2026-07-01T09:00:00+08:00";
    state.completedTasks["old-task"] = "2026-07-01T09:00:00+08:00";
    state.verifiedTasks["old-task"] = "2026-07-01T09:01:00+08:00";
    state.pendingVerifications["pending-task"] = {
      eventId: "old-verification",
      occurredAt: "2026-07-01T09:02:00+08:00",
    };

    const next = applyDshEvent(
      state,
      {
        id: "status-with-history",
        type: "agent.status",
        occurredAt: "2026-08-26T10:00:00+08:00",
        status: "completed",
      },
      deps,
    );

    expect(next.agentStatus).toBe("completed");
    expect(next.dailyLedgers).toBe(state.dailyLedgers);
    expect(next.completedTasks).toBe(state.completedTasks);
    expect(next.verifiedTasks).toBe(state.verifiedTasks);
    expect(next.pendingVerifications).toBe(state.pendingVerifications);
    expect(next.processedEvents).toEqual({
      "old-event": "2026-07-01T09:00:00+08:00",
      "status-with-history": "2026-08-26T10:00:00+08:00",
    });
  });
});
