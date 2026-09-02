const STARS = [
  { x: 8, y: 12, size: "large", delay: "-1.7s" },
  { x: 29, y: 31, size: "small", delay: "-.4s" },
  { x: 53, y: 9, size: "medium", delay: "-2.2s" },
  { x: 100, y: 44, size: "small", delay: "-1.1s" },
  { x: 16, y: 74, size: "small", delay: "-2.8s" },
  { x: 57, y: 89, size: "medium", delay: "-.8s" },
  { x: 104, y: 82, size: "small", delay: "-2s" },
] as const;

type MoonRun = readonly [
  row: number,
  startColumn: number,
  cellLength: number,
];

const MOON_CELL_SIZE = 7;
const MOON_VIEWBOX_SIZE = 217;

// Rasterized from two offset circles on a 31 × 31 grid. The shared circular
// geometry keeps both edges rounded while the small vertical offset gives the
// two horns the hand-drawn asymmetry used by the rest of the scene.
const MOON_SILHOUETTE_RUNS = [
  [1, 12, 6],
  [2, 9, 7],
  [3, 7, 7],
  [4, 6, 7],
  [5, 5, 7],
  [6, 4, 7],
  [7, 3, 8],
  [8, 3, 7],
  [9, 2, 8],
  [10, 2, 7],
  [11, 2, 7],
  [12, 1, 8],
  [13, 1, 8],
  [14, 1, 8],
  [15, 1, 8],
  [16, 1, 8],
  [17, 1, 8],
  [18, 1, 8],
  [19, 2, 7],
  [20, 2, 8],
  [21, 2, 8],
  [22, 3, 8],
  [23, 3, 8],
  [24, 4, 8],
  [25, 5, 8],
  [26, 6, 8],
  [27, 7, 8],
  [28, 9, 8],
  [29, 12, 7],
] as const satisfies readonly MoonRun[];

const MOON_BODY_RUNS: readonly MoonRun[] = MOON_SILHOUETTE_RUNS.map(
  ([row, startColumn, cellLength]) => [row, startColumn + 1, cellLength - 2],
);

const MOON_INNER_ARC_RUNS: readonly MoonRun[] = MOON_SILHOUETTE_RUNS.map(
  ([row, startColumn, cellLength]) => [row, startColumn + cellLength - 1, 1],
);

const MOON_CRATER_RUNS = [
  [8, 6, 2],
  [9, 6, 1],
  [14, 4, 2],
  [15, 4, 1],
  [22, 7, 2],
  [23, 7, 2],
  [24, 8, 1],
] as const satisfies readonly MoonRun[];

const MOON_HIGHLIGHT_RUNS = [
  [2, 11, 2],
  [3, 9, 2],
  [4, 7, 2],
  [5, 6, 1],
  [9, 3, 1],
  [13, 2, 1],
  [20, 3, 1],
] as const satisfies readonly MoonRun[];

function MoonLayer({
  fill,
  layer,
  runs,
}: {
  fill: string;
  layer: "outline" | "body" | "inner-arc" | "crater" | "highlight";
  runs: readonly MoonRun[];
}) {
  return (
    <g data-moon-layer={layer} fill={fill}>
      {runs.map(([row, startColumn, cellLength], index) => (
        <rect
          key={`${row}-${startColumn}-${index}`}
          data-moon-pixel
          x={startColumn * MOON_CELL_SIZE}
          y={row * MOON_CELL_SIZE}
          width={cellLength * MOON_CELL_SIZE}
          height={MOON_CELL_SIZE}
        />
      ))}
    </g>
  );
}

export function NightSky() {
  return (
    <div
      className="desktop__night-sky"
      data-night-sky="moon-stars"
      data-night-anchor="workbench"
      aria-hidden="true"
    >
      <svg
        className="desktop__pixel-moon"
        data-moon-art="hand-drawn-pixels"
        data-moon-phase="crescent"
        data-moon-style="rounded-crescent"
        data-moon-arc="offset-circles"
        data-moon-grid="31"
        viewBox={`0 0 ${MOON_VIEWBOX_SIZE} ${MOON_VIEWBOX_SIZE}`}
        width={MOON_VIEWBOX_SIZE}
        height={MOON_VIEWBOX_SIZE}
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        <MoonLayer fill="#4b3828" layer="outline" runs={MOON_SILHOUETTE_RUNS} />
        <MoonLayer fill="#f3d47e" layer="body" runs={MOON_BODY_RUNS} />
        <MoonLayer fill="#b57939" layer="inner-arc" runs={MOON_INNER_ARC_RUNS} />
        <MoonLayer fill="#d5aa59" layer="crater" runs={MOON_CRATER_RUNS} />
        <MoonLayer fill="#fff3bd" layer="highlight" runs={MOON_HIGHLIGHT_RUNS} />
      </svg>
      {STARS.map((star, index) => (
        <span
          key={`${star.x}-${star.y}`}
          className={`desktop__pixel-star desktop__pixel-star--${star.size}`}
          data-star-index={index + 1}
          style={{ left: star.x, top: star.y, animationDelay: star.delay }}
        />
      ))}
    </div>
  );
}
