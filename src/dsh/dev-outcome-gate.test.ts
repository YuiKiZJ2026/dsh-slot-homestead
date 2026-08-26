import { describe, expect, it } from "vitest";
import { developmentOutcomeOverridesEnabled } from "./dev-outcome-gate";

describe("developmentOutcomeOverridesEnabled", () => {
  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ] as const)(
    "returns %s runtime DEV and %s request as %s",
    (runtimeDev, requested, expected) => {
      expect(developmentOutcomeOverridesEnabled(runtimeDev, requested)).toBe(expected);
    },
  );
});
