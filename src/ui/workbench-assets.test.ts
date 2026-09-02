// @ts-expect-error Node built-ins are available in Vitest; this browser project intentionally omits @types/node.
import { createRequire } from "node:module";
// @ts-expect-error Node built-ins are available in Vitest; this browser project intentionally omits @types/node.
import { readFileSync } from "node:fs";
// @ts-expect-error Node built-ins are available in Vitest; this browser project intentionally omits @types/node.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PngImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: { sync: { read(input: Uint8Array): PngImage } };
};

// @ts-expect-error Node globals are available in Vitest; this browser project intentionally omits @types/node.
const root = process.cwd();

function loadAsset(name: string): PngImage {
  return PNG.sync.read(readFileSync(resolve(root, "public", "assets", name)));
}

function alphaBounds(image: PngImage): { left: number; top: number; right: number; bottom: number } {
  let left = image.width;
  let top = image.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return { left, top, right, bottom };
}

function opaqueCoverage(
  image: PngImage,
  bounds: { left: number; top: number; right: number; bottom: number },
): number {
  let opaque = 0;
  const area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] === 255) opaque += 1;
    }
  }
  return opaque / area;
}

describe("single workbench raster contract", () => {
  it("ships one continuous 704px desk surface with no transparent join", () => {
    const table = loadAsset("ecosystem-workbench-table-v3.png");
    expect([table.width, table.height]).toEqual([704, 304]);

    const frontEdgeAlpha = Array.from({ length: 704 }, (_, x) => table.data[(228 * 704 + x) * 4 + 3]);
    expect(frontEdgeAlpha.slice(16, 688).every((alpha) => alpha > 0)).toBe(true);
    expect(frontEdgeAlpha.slice(318, 391).every((alpha) => alpha > 0)).toBe(true);
  });

  it("keeps fixed slot equipment but removes every pixel of the old desk", () => {
    const equipment = loadAsset("ecosystem-slot-equipment-v3.png");
    expect([equipment.width, equipment.height]).toEqual([704, 304]);
    expect(alphaBounds(equipment).bottom).toBeLessThanOrEqual(228);
    for (let y = 228; y < equipment.height; y += 1) {
      for (let x = 0; x < equipment.width; x += 1) {
        expect(equipment.data[(y * equipment.width + x) * 4 + 3]).toBe(0);
      }
    }
  });

  it("separates the complete watering can from the garden bed", () => {
    const bed = loadAsset("ecosystem-garden-bed-v3.png");
    const wateringCan = loadAsset("ecosystem-garden-watering-can-v3.png");
    expect([bed.width, bed.height]).toEqual([784, 576]);
    expect([wateringCan.width, wateringCan.height]).toEqual([784, 576]);
    expect(alphaBounds(bed)).toEqual({ left: 166, top: 144, right: 737, bottom: 431 });
    expect(alphaBounds(wateringCan)).toEqual({ left: 11, top: 246, right: 160, bottom: 352 });

    const alphaValues = new Set<number>();
    for (let offset = 3; offset < wateringCan.data.length; offset += 4) {
      alphaValues.add(wateringCan.data[offset]!);
    }
    expect([...alphaValues].sort((a, b) => a - b)).toEqual([0, 255]);
    expect(opaqueCoverage(wateringCan, { left: 11, top: 246, right: 160, bottom: 352 }))
      .toBeGreaterThanOrEqual(0.45);
    expect(opaqueCoverage(wateringCan, { left: 60, top: 300, right: 100, bottom: 335 }))
      .toBeGreaterThanOrEqual(0.95);
  });
});
