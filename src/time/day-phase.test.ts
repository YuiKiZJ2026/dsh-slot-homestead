import { describe, expect, it } from "vitest";
import { dayPhaseLabel, resolveDayPhase } from "./day-phase";

describe("resolveDayPhase", () => {
  it.each([
    [4, 59, "night"],
    [5, 0, "dawn"],
    [7, 59, "dawn"],
    [8, 0, "day"],
    [16, 59, "day"],
    [17, 0, "dusk"],
    [19, 59, "dusk"],
    [20, 0, "night"],
    [23, 59, "night"],
  ] as const)("maps %i:%i local time to %s", (hour, minute, expected) => {
    expect(resolveDayPhase(new Date(2026, 7, 31, hour, minute))).toBe(expected);
  });

  it("provides concise Chinese labels for every phase", () => {
    expect((["dawn", "day", "dusk", "night"] as const).map(dayPhaseLabel)).toEqual([
      "清晨微光",
      "日间明亮",
      "傍晚暖光",
      "夜间熄灯",
    ]);
  });
});
