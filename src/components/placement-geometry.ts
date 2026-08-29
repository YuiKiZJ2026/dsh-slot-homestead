import { TABLE_POSITIONS, type TablePosition } from "../domain/table-positions";
import type { TablePlacement } from "../domain/types";

export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

export function nearestTablePosition(
  point: ScenePoint,
  _placements: readonly TablePlacement[],
  _draggedItemId: string,
  snapRadius = 34,
): TablePosition | null {
  let nearest: TablePosition | null = null;
  let nearestDistance = snapRadius;
  for (const position of TABLE_POSITIONS) {
    const distance = Math.hypot(point.x - position.x, point.y - position.y);
    if (distance > nearestDistance) continue;
    nearest = position;
    nearestDistance = distance;
  }
  return nearest;
}
