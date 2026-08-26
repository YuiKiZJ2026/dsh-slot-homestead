import type { ReelSymbol } from "../../domain/types";

export interface AtlasFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneAssets {
  scene: HTMLImageElement;
  reels: HTMLImageElement;
  collectibles: HTMLImageElement;
}

export interface SceneAssetUrls {
  readonly scene: string;
  readonly reels: string;
  readonly collectibles: string;
}

export const ASSET_FRAMES: {
  readonly reels: Readonly<Record<ReelSymbol, AtlasFrame>>;
  readonly collectibles: Readonly<Record<string, AtlasFrame>>;
} = {
  reels: {
    coin: { x: 0, y: 0, width: 18, height: 18 },
    leaf: { x: 18, y: 0, width: 18, height: 18 },
    crystal: { x: 36, y: 0, width: 18, height: 18 },
    moon: { x: 54, y: 0, width: 18, height: 18 },
    robot: { x: 72, y: 0, width: 18, height: 18 },
  },
  collectibles: {
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
  },
};

export const DISPLAY_SLOTS = [
  { x: 44, y: 214 }, { x: 92, y: 223 }, { x: 144, y: 218 }, { x: 205, y: 224 },
  { x: 42, y: 164 }, { x: 98, y: 174 }, { x: 274, y: 188 }, { x: 330, y: 192 },
  { x: 44, y: 112 }, { x: 100, y: 118 }, { x: 284, y: 125 }, { x: 336, y: 132 },
] as const;

export const DEFAULT_SCENE_ASSET_URLS: SceneAssetUrls = {
  scene: "/assets/scene-base.png",
  reels: "/assets/reel-symbols-runtime.png",
  collectibles: "/assets/collectibles.png",
} as const;

export async function loadSceneAssets(
  urls: SceneAssetUrls = DEFAULT_SCENE_ASSET_URLS,
): Promise<SceneAssets> {
  const [scene, reels, collectibles] = await Promise.all([
    loadImage(urls.scene),
    loadImage(urls.reels),
    loadImage(urls.collectibles),
  ]);

  return { scene, reels, collectibles };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load scene asset: ${url}`));
    image.src = url;
  });
}
