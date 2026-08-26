import { afterEach, describe, expect, it } from "vitest";
import { ASSET_FRAMES, DISPLAY_SLOTS, loadSceneAssets } from "./assets";

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

  it("exports all twelve accepted display centers in catalog order", () => {
    expect(DISPLAY_SLOTS).toEqual([
      { x: 44, y: 214 }, { x: 92, y: 223 }, { x: 144, y: 218 }, { x: 205, y: 224 },
      { x: 42, y: 164 }, { x: 98, y: 174 }, { x: 274, y: 188 }, { x: 330, y: 192 },
      { x: 44, y: 112 }, { x: 100, y: 118 }, { x: 284, y: 125 }, { x: 336, y: 132 },
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
