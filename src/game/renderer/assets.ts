import type { ReelSymbol } from "../../domain/types";
import { TABLE_POSITIONS, type TablePosition } from "../../domain/table-positions";

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

export interface VisibleBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const COLLECTIBLE_VISIBLE_BOUNDS: Readonly<Record<string, VisibleBounds>> = {
  plant: { left: 17, top: 6, right: 78, bottom: 90 },
  "book-stand": { left: 12, top: 6, right: 84, bottom: 90 },
  "desk-clock": { left: 13, top: 6, right: 83, bottom: 90 },
  "warm-mug": { left: 19, top: 6, right: 76, bottom: 90 },
  toolbox: { left: 8, top: 6, right: 87, bottom: 90 },
  "paper-lantern": { left: 23, top: 6, right: 72, bottom: 90 },
  crystal: { left: 29, top: 6, right: 66, bottom: 73 },
  "moon-lamp": { left: 21, top: 6, right: 75, bottom: 90 },
  "mini-robot": { left: 24, top: 6, right: 72, bottom: 90 },
  "star-projector": { left: 11, top: 6, right: 84, bottom: 90 },
  "constellation-globe": { left: 18, top: 6, right: 78, bottom: 90 },
  "comet-badge": { left: 7, top: 6, right: 89, bottom: 90 },
};

export interface CollectiblePlacementRect {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export function collectiblePlacementRect(
  itemId: string,
  position: Pick<TablePosition, "x" | "y" | "size">,
): CollectiblePlacementRect {
  const frame = ASSET_FRAMES.collectibles[itemId];
  const visible = COLLECTIBLE_VISIBLE_BOUNDS[itemId];
  if (frame === undefined || visible === undefined) {
    return {
      x: position.x - position.size / 2,
      y: position.y - position.size,
      size: position.size,
    };
  }
  const visibleHeight = Math.max(1, visible.bottom - visible.top);
  const size = position.size * frame.height / visibleHeight;
  const visibleCenterX = (visible.left + visible.right) / 2 / frame.width;
  const visibleBottomY = visible.bottom / frame.height;
  return {
    x: position.x - visibleCenterX * size,
    y: position.y - visibleBottomY * size,
    size,
  };
}

export const DISPLAY_SLOTS = TABLE_POSITIONS;

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
