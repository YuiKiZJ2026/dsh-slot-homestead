import { afterEach, describe, expect, it, vi } from "vitest";
import { OffsetSystemClock } from "./clock";

afterEach(() => vi.useRealTimers());

describe("OffsetSystemClock", () => {
  it("keeps following wall time after a demo date adjustment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T08:00:00.000Z"));
    const clock = new OffsetSystemClock();

    clock.set(new Date("2026-08-27T08:00:00.000Z"));
    vi.advanceTimersByTime(6 * 60 * 60 * 1_000);

    expect(clock.now().toISOString()).toBe("2026-08-27T14:00:00.000Z");
  });
});
