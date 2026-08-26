import { describe, expect, it, vi } from "vitest";
import { FixedClock } from "../time/clock";
import { MockDshAdapter } from "./mock-adapter";

describe("MockDshAdapter", () => {
  it("emits task, verification, focus, and status events with unique IDs", () => {
    const adapter = new MockDshAdapter(
      new FixedClock(new Date("2026-08-26T08:00:00Z")),
      () => "reused-id",
    );
    const listener = vi.fn();
    adapter.subscribe(listener);

    const taskId = adapter.completeTask();
    adapter.verifyTask(taskId);
    adapter.addFocusHour();
    adapter.setAgentStatus("error");

    const events = listener.mock.calls.map(([event]) => event);
    expect(events.map((event) => event.type)).toEqual([
      "task.completed",
      "task.verified",
      "focus.minutes",
      "agent.status",
    ]);
    expect(new Set(events.map((event) => event.id)).size).toBe(4);
    expect(events[0]).toMatchObject({ taskId, occurredAt: "2026-08-26T08:00:00.000Z" });
    expect(events[1]).toMatchObject({ taskId });
    expect(events[2]).toMatchObject({ minutes: 60 });
    expect(events[3]).toMatchObject({ status: "error" });
  });

  it("returns unique task IDs even when the injected ID source repeats", () => {
    const adapter = new MockDshAdapter(
      new FixedClock(new Date("2026-08-26T08:00:00Z")),
      () => "same",
    );

    expect(adapter.completeTask()).not.toBe(adapter.completeTask());
  });

  it("stops delivering events after unsubscribe", () => {
    const adapter = new MockDshAdapter(
      new FixedClock(new Date("2026-08-26T08:00:00Z")),
      () => crypto.randomUUID(),
    );
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);

    adapter.addFocusHour();
    unsubscribe();
    adapter.addFocusHour();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("advances only its clock by one local calendar day", () => {
    const clock = new FixedClock(new Date(2026, 7, 26, 8, 30));
    const adapter = new MockDshAdapter(clock, () => crypto.randomUUID());
    const listener = vi.fn();
    adapter.subscribe(listener);

    adapter.advanceDay();

    expect(clock.now()).toEqual(new Date(2026, 7, 27, 8, 30));
    expect(listener).not.toHaveBeenCalled();
  });

  it("consumes a development outcome override once", () => {
    const adapter = new MockDshAdapter(
      new FixedClock(new Date("2026-08-26T08:00:00Z")),
      () => crypto.randomUUID(),
    );

    adapter.presetNextOutcome("rare");

    expect(adapter.consumeNextOutcome()).toBe("rare");
    expect(adapter.consumeNextOutcome()).toBeNull();
  });

  it("does not expose an outcome override outside development mode", () => {
    const adapter = new MockDshAdapter(
      new FixedClock(new Date("2026-08-26T08:00:00Z")),
      () => crypto.randomUUID(),
      false,
    );

    adapter.presetNextOutcome("rare");

    expect(adapter.consumeNextOutcome()).toBeNull();
  });
});
