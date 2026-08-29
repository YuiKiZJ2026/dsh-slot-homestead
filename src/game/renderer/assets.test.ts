import { afterEach, describe, expect, it } from "vitest";
import {
  ASSET_FRAMES,
  COLLECTIBLE_VISIBLE_BOUNDS,
  collectiblePlacementRect,
  DISPLAY_SLOTS,
  loadSceneAssets,
} from "./assets";

const originalImage = globalThis.Image;

afterEach(() => {
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: originalImage,
  });
});

describe("asset manifest", () => {
  it("maps five reel symbols and twelve collectibles to fixed atlas cells", () => {
    expect(ASSET_FRAMES.reels).toEqual({
      coin: { x: 0, y: 0, width: 18, height: 18 },
      leaf: { x: 18, y: 0, width: 18, height: 18 },
      crystal: { x: 36, y: 0, width: 18, height: 18 },
      moon: { x: 54, y: 0, width: 18, height: 18 },
      robot: { x: 72, y: 0, width: 18, height: 18 },
    });
    expect(ASSET_FRAMES.collectibles).toEqual({
      plant: { x: 0, y: 0, width: 96, height: 96 },
      "book-stand": { x: 96, y: 0, width: 96, height: 96 },
      "desk-clock": { x: 192, y: 0, width: 96, height: 96 },
      "warm-mug": { x: 288, y: 0, width: 96, height: 96 },
      toolbox: { x: 0, y: 96, width: 96, height: 96 },
      "paper-lantern": { x: 96, y: 96, width: 96, height: 96 },
      crystal: { x: 192, y: 96, width: 96, height: 96 },
      "moon-lamp": { x: 288, y: 96, width: 96, height: 96 },
      "mini-robot": { x: 0, y: 192, width: 96, height: 96 },
      "star-projector": { x: 96, y: 192, width: 96, height: 96 },
      "constellation-globe": { x: 192, y: 192, width: 96, height: 96 },
      "comet-badge": { x: 288, y: 192, width: 96, height: 96 },
    });
  });

  it.each(["plant", "crystal", "comet-badge"])(
    "centers the visible pixels of %s and rests their visible bottom on the pedestal",
    (itemId) => {
      const bounds = COLLECTIBLE_VISIBLE_BOUNDS[itemId]!;
      const rect = collectiblePlacementRect(itemId, { x: 187, y: 224, size: 54 });
      const visibleCenter = rect.x + ((bounds.left + bounds.right) / 2 / 96) * rect.size;
      const visibleBottom = rect.y + (bounds.bottom / 96) * rect.size;
      expect(visibleCenter).toBeCloseTo(187, 5);
      expect(visibleBottom).toBeCloseTo(224, 5);
    },
  );

  it("normalizes unusually short art instead of rendering it as a tiny unknown blob", () => {
    expect(collectiblePlacementRect("crystal", { x: 187, y: 224, size: 54 }).size)
      .toBeGreaterThan(collectiblePlacementRect("plant", { x: 187, y: 224, size: 54 }).size);
  });

  it.each(["plant", "desk-clock", "book-stand"])(
    "renders the visible height of %s at the full nominal pedestal size",
    (itemId) => {
      const bounds = COLLECTIBLE_VISIBLE_BOUNDS[itemId]!;
      const rect = collectiblePlacementRect(itemId, { x: 187, y: 224, size: 54 });
      const visibleHeight = (bounds.bottom - bounds.top) / 96 * rect.size;
      expect(visibleHeight).toBeCloseTo(54, 5);
    },
  );

  it("exports all twelve accepted display centers in catalog order", () => {
    expect(DISPLAY_SLOTS).toEqual([
      { id: "left-rear-round", label: "左后圆台", x: 62, y: 72, size: 46 },
      { id: "left-rear-small", label: "左后小台", x: 123, y: 78, size: 40 },
      { id: "right-rear-small", label: "右后小台", x: 314, y: 94, size: 40 },
      { id: "right-rear-round", label: "右中圆台", x: 320, y: 143, size: 46 },
      { id: "left-middle-round", label: "左中圆台", x: 62, y: 140, size: 50 },
      { id: "left-middle-small", label: "左中小台", x: 119, y: 144, size: 44 },
      { id: "right-middle-small", label: "右前小台", x: 267, y: 197, size: 46 },
      { id: "right-middle-round", label: "右前圆台", x: 329, y: 196, size: 54 },
      { id: "left-front-round", label: "左前圆台", x: 53, y: 196, size: 54 },
      { id: "left-front-small", label: "左前小台", x: 111, y: 196, size: 46 },
      { id: "center-front", label: "中央台左位", x: 170, y: 197, size: 42 },
      { id: "right-front-round", label: "中央台右位", x: 204, y: 197, size: 42 },
    ]);
  });
});

describe("loadSceneAssets", () => {
  it("loads the scene and both atlases from their public URLs", async () => {
    installImageDouble(() => "load");

    const assets = await loadSceneAssets();

    expect(assets.scene.src).toBe("/assets/scene-base.png");
    expect(assets.reels.src).toBe("/assets/reel-symbols-runtime.png");
    expect(assets.collectibles.src).toBe("/assets/collectibles.png");
  });

  it("rejects when any required image fails to load", async () => {
    installImageDouble((url) => url.endsWith("reel-symbols-runtime.png") ? "error" : "load");

    await expect(loadSceneAssets()).rejects.toThrow();
  });

  it("loads explicit bundle-owned data URLs instead of assuming a public asset route", async () => {
    installImageDouble(() => "load");
    const urls = {
      scene: "data:image/png;base64,scene",
      reels: "data:image/png;base64,reels",
      collectibles: "data:image/png;base64,collectibles",
    };

    const assets = await loadSceneAssets(urls);

    expect(assets.scene.src).toBe(urls.scene);
    expect(assets.reels.src).toBe(urls.reels);
    expect(assets.collectibles.src).toBe(urls.collectibles);
  });
});

function installImageDouble(resultFor: (url: string) => "load" | "error"): void {
  class ImageDouble {
    onload: ((event: Event) => void) | null = null;
    onerror: ((event: Event | string) => void) | null = null;
    private source = "";

    get src(): string {
      return this.source;
    }

    set src(value: string) {
      this.source = value;
      queueMicrotask(() => {
        if (resultFor(value) === "load") {
          this.onload?.(new Event("load"));
        } else {
          this.onerror?.(new Event("error"));
        }
      });
    }
  }

  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: ImageDouble,
  });
}
