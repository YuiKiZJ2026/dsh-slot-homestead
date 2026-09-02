import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Clock } from "./clock";
import { useDayPhase } from "./use-day-phase";

class MutableClock implements Clock {
  readonly now = vi.fn(() => new Date(this.value));

  constructor(private value: Date) {}

  set(value: Date): void {
    this.value = value;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDayPhase", () => {
  it("refreshes from its real-time clock every minute", () => {
    const clock = new MutableClock(new Date(2026, 7, 31, 16, 59));
    const { result } = renderHook(() => useDayPhase(clock));

    expect(result.current).toBe("day");
    clock.set(new Date(2026, 7, 31, 17, 0));
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current).toBe("dusk");
  });

  it("refreshes when the window regains focus or page visibility changes", () => {
    const clock = new MutableClock(new Date(2026, 7, 31, 7, 59));
    const { result } = renderHook(() => useDayPhase(clock));

    clock.set(new Date(2026, 7, 31, 8, 0));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe("day");

    clock.set(new Date(2026, 7, 31, 20, 0));
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe("night");
  });

  it("removes timers and browser listeners when unmounted", () => {
    const clock = new MutableClock(new Date(2026, 7, 31, 8, 0));
    const { unmount } = renderHook(() => useDayPhase(clock));
    const callsBeforeUnmount = clock.now.mock.calls.length;

    unmount();
    clock.set(new Date(2026, 7, 31, 20, 0));
    act(() => {
      vi.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(clock.now).toHaveBeenCalledTimes(callsBeforeUnmount);
  });
});
