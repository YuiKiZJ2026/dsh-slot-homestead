export interface ReelDraw {
  sx: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface ReelDrawGroups {
  left: ReelDraw[];
  center: ReelDraw[];
  right: ReelDraw[];
}

const DESTINATION_X_RANGES = {
  left: { minimum: 177, maximum: 180 },
  center: { minimum: 202, maximum: 205 },
  right: { minimum: 226, maximum: 229 },
} as const;

export function groupDrawsByReelWindow(draws: readonly ReelDraw[]): ReelDrawGroups {
  const groups: ReelDrawGroups = { left: [], center: [], right: [] };
  for (const draw of draws) {
    for (const [name, range] of Object.entries(DESTINATION_X_RANGES)) {
      if (draw.dx >= range.minimum && draw.dx <= range.maximum) {
        groups[name as keyof ReelDrawGroups].push(draw);
        break;
      }
    }
  }
  return groups;
}
