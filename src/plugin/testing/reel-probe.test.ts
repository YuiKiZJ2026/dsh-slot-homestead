import { describe, expect, it } from "vitest";
import { groupDrawsByReelWindow, type ReelDraw } from "./reel-probe";

describe("native preview reel draw probe", () => {
  it("groups interleaved atlas draws by destination window rather than call order", () => {
    const draws: ReelDraw[] = [
      draw(18, 177), draw(36, 202), draw(54, 226),
      draw(72, 180), draw(18, 205), draw(36, 229),
      draw(36, 179), draw(54, 204), draw(72, 228),
      draw(54, 178), draw(72, 203), draw(18, 227),
    ];

    expect(groupDrawsByReelWindow(draws)).toEqual({
      left: [draws[0], draws[3], draws[6], draws[9]],
      center: [draws[1], draws[4], draws[7], draws[10]],
      right: [draws[2], draws[5], draws[8], draws[11]],
    });
  });

  it("does not misclassify repeated draws from one window as three reels", () => {
    const leftOnly = Array.from({ length: 12 }, (_, index) => draw(18 + index * 18, 177));

    expect(groupDrawsByReelWindow(leftOnly)).toEqual({
      left: leftOnly,
      center: [],
      right: [],
    });
  });
});

function draw(sx: number, dx: number): ReelDraw {
  return { sx, dx, dy: 60, dw: 18, dh: 18 };
}
