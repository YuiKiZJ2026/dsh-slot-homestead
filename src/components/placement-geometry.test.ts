import { describe, expect, it } from "vitest";
import { nearestTablePosition } from "./placement-geometry";

describe("nearestTablePosition", () => {
  it("magnetically selects the nearest tabletop anchor inside the snap radius", () => {
    expect(nearestTablePosition({ x: 55, y: 194 }, [], "plant")?.id).toBe("left-front-round");
  });

  it("does not snap when the pointer is outside every tabletop anchor", () => {
    expect(nearestTablePosition({ x: 190, y: 20 }, [], "plant")).toBeNull();
  });

  it("allows replacement of an occupied anchor so the displaced item returns to storage", () => {
    expect(nearestTablePosition(
      { x: 44, y: 214 },
      [{ itemId: "crystal", positionId: "left-front-round" }],
      "plant",
    )?.id).toBe("left-front-round");
  });
});
