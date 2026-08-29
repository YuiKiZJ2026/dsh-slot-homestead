import type { TablePositionId } from "./types";

export interface TablePosition {
  readonly id: TablePositionId;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export const TABLE_POSITIONS = [
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
] as const satisfies readonly TablePosition[];

export const TABLE_POSITION_IDS = TABLE_POSITIONS.map((position) => position.id) as [
  TablePositionId,
  ...TablePositionId[],
];

export const TABLE_POSITION_BY_ID = Object.fromEntries(
  TABLE_POSITIONS.map((position) => [position.id, position]),
) as Readonly<Record<TablePositionId, TablePosition>>;

export function isTablePositionId(value: string): value is TablePositionId {
  return Object.prototype.hasOwnProperty.call(TABLE_POSITION_BY_ID, value);
}

export function legacyPlacements(
  displayedCollectibles: readonly string[],
): TablePlacementLike[] {
  return displayedCollectibles.slice(0, TABLE_POSITIONS.length).map((itemId, index) => ({
    itemId,
    positionId: TABLE_POSITIONS[index]!.id,
  }));
}

interface TablePlacementLike {
  itemId: string;
  positionId: TablePositionId;
}
