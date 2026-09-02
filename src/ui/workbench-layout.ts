import type { HabitatId } from "../domain/types";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SourceBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const WORKBENCH_STAGE = { width: 704, height: 304 } as const;
export const TABLE_FRONT_Y = 228;
export const ECOSYSTEM_TABLE_WIDTH = 360;
export const SLOT_STATIC_CROP_LEFT = 69;
export const SLOT_CANVAS_RECT = { x: 320, y: 0, width: 384, height: 288 } as const;
export const HABITAT_SOURCE_SIZE = { width: 784, height: 576 } as const;
export const HABITAT_SAFE_RECT = { left: 32, top: 8, right: 324, bottom: 218 } as const;

const HABITAT_CONTENT_RECTS: Readonly<Record<HabitatId, SourceBounds>> = {
  aquarium: HABITAT_SAFE_RECT,
  garden: { ...HABITAT_SAFE_RECT, left: 48 },
  animals: HABITAT_SAFE_RECT,
};

export const HABITAT_VISIBLE_SOURCE_BOUNDS: Readonly<Record<HabitatId, SourceBounds>> = {
  aquarium: { left: 109, top: 20, right: 675, bottom: 446 },
  garden: { left: 11, top: 144, right: 737, bottom: 431 },
  animals: { left: 55, top: 95, right: 728, bottom: 442 },
};

export function habitatStageRect(habitat: HabitatId): Rect {
  const bounds = HABITAT_VISIBLE_SOURCE_BOUNDS[habitat];
  const contentRect = HABITAT_CONTENT_RECTS[habitat];
  const safeWidth = contentRect.right - contentRect.left;
  const safeHeight = contentRect.bottom - contentRect.top;
  const scale = Math.min(
    safeWidth / (bounds.right - bounds.left),
    safeHeight / (bounds.bottom - bounds.top),
  );

  return {
    x: contentRect.right - bounds.right * scale,
    y: contentRect.bottom - bounds.bottom * scale,
    width: HABITAT_SOURCE_SIZE.width * scale,
    height: HABITAT_SOURCE_SIZE.height * scale,
  };
}

export function habitatVisibleRect(habitat: HabitatId): {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
} {
  const bounds = HABITAT_VISIBLE_SOURCE_BOUNDS[habitat];
  const stage = habitatStageRect(habitat);
  const scale = stage.width / HABITAT_SOURCE_SIZE.width;
  return {
    left: stage.x + bounds.left * scale,
    top: stage.y + bounds.top * scale,
    right: stage.x + bounds.right * scale,
    bottom: stage.y + bounds.bottom * scale,
  };
}
