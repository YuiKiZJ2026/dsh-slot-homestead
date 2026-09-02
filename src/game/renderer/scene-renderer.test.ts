import { describe, expect, it } from "vitest";
import type { AgentStatus, ReelSymbol } from "../../domain/types";
import type { SceneViewModel } from "./animation";
import { SceneRenderer } from "./scene-renderer";

interface RecordedCall {
  name: string;
  args: number[];
  style?: string;
}

interface RecordingContext extends CanvasRenderingContext2D {
  calls: RecordedCall[];
}

const assets = {
  scene: { kind: "scene" } as unknown as HTMLImageElement,
  reels: { kind: "reels" } as unknown as HTMLImageElement,
  collectibles: { kind: "collectibles" } as unknown as HTMLImageElement,
};

function viewModel(patch: Partial<SceneViewModel> = {}): SceneViewModel {
  return {
    reels: ["coin", "leaf", "moon"],
    reelCells: [
      ["coin", "coin", "coin", "coin"],
      ["leaf", "leaf", "leaf", "leaf"],
      ["moon", "moon", "moon", "moon"],
    ],
    reelOffsets: [0, 0, 0],
    reelStopped: [true, true, true],
    leverProgress: 0,
    coins: [],
    sparkles: [],
    displayed: [],
    placements: [],
    payoutCollectibleId: null,
    payoutCoinAmount: 0,
    agentStatus: "idle",
    starryTheme: false,
    complete: false,
    ...patch,
  };
}

describe("SceneRenderer", () => {
  it("disables smoothing in the constructor and resets it before every render", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    expect(context.imageSmoothingEnabled).toBe(false);
    context.imageSmoothingEnabled = true;
    renderer.render(viewModel());
    expect(context.imageSmoothingEnabled).toBe(false);
    context.imageSmoothingEnabled = true;
    renderer.render(viewModel());
    expect(context.imageSmoothingEnabled).toBe(false);
  });

  it("draws every animated layer in the required order", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({
      starryTheme: true,
      leverProgress: 1,
      displayed: ["plant"],
      placements: [{ itemId: "plant", positionId: "left-front-round" }],
      payoutCollectibleId: "crystal",
      payoutPosition: { x: 224, y: 188 },
      coins: [{ x: 210.5, y: 170.25, startY: 202, size: 3 }],
      sparkles: [{ x: 200.5, y: 150.25, frame: 1 }],
      agentStatus: "working",
    }));

    const names = context.calls.map((call) => call.name);
    expect(names[0]).toBe("clear");
    expect(firstIndex(names, "star")).toBeLessThan(firstIndex(names, "scene"));
    expect(firstIndex(names, "scene")).toBeLessThan(firstIndex(names, "reel"));
    expect(lastIndex(names, "reel")).toBeLessThan(firstIndex(names, "lever"));
    expect(lastIndex(names, "lever")).toBeLessThan(firstIndex(names, "displayed"));
    expect(firstIndex(names, "displayed")).toBeLessThan(firstIndex(names, "payout"));
    expect(firstIndex(names, "payout")).toBeLessThan(firstIndex(names, "coin"));
    expect(lastIndex(names, "coin")).toBeLessThan(firstIndex(names, "sparkle"));
    expect(lastIndex(names, "sparkle")).toBeLessThan(firstIndex(names, "status"));
  });

  it("can render only the live equipment layers over a unified static workbench", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets, { includeSceneBase: false });

    renderer.render(viewModel());

    expect(context.calls.some((call) => call.name === "scene")).toBe(false);
    expect(context.calls.filter((call) => call.name === "reel")).toHaveLength(3);
    expect(context.calls.some((call) => call.name === "lever")).toBe(true);
  });

  it("clips and restores each reel window independently", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({ reelStopped: [false, false, false], reelOffsets: [7, 11, 19] }));

    expect(context.calls.filter((call) => call.name === "clip")).toHaveLength(3);
    expect(context.calls.filter((call) => call.name === "reel")).toHaveLength(12);
    expect(context.calls.filter((call) => call.name === "save")).toHaveLength(3);
    expect(context.calls.filter((call) => call.name === "restore")).toHaveLength(3);
    for (const clipIndex of indexes(context.calls, "clip")) {
      expect(context.calls[clipIndex - 1]?.name).toBe("rect");
      expect(context.calls.slice(clipIndex + 1).some((call) => call.name === "restore")).toBe(true);
    }
  });

  it("uses the exact reel apertures and varied source frames for each running belt", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({
      reels: ["leaf", "moon", "coin"],
      reelStopped: [false, false, false],
      reelOffsets: [18, 36, 54],
      reelCells: [
        ["coin", "moon", "crystal", "robot"],
        ["coin", "leaf", "crystal", "robot"],
        ["leaf", "moon", "crystal", "robot"],
      ],
    }));

    const clips = context.calls.filter((call) => call.name === "rect");
    expect(clips.map((call) => call.args)).toEqual([
      [177, 72, 22, 37],
      [202, 72, 22, 37],
      [226, 72, 21, 37],
    ]);

    for (let column = 0; column < 3; column += 1) {
      const draws = context.calls.filter((call) => call.name === "reel").slice(column * 4, column * 4 + 4);
      expect(new Set(draws.map((call) => call.args[0])).size).toBe(4);
      const clipIndex = context.calls.indexOf(clips[column]);
      const restoreIndex = context.calls.indexOf(
        context.calls.slice(clipIndex).find((call) => call.name === "restore")!,
      );
      expect(context.calls.slice(clipIndex + 1, restoreIndex).filter((call) => call.name === "reel"))
        .toHaveLength(4);
    }
  });

  it("keeps a symbol's visible identity continuous at the exact 17-to-18 pixel boundary", () => {
    const before = recordingContext();
    const after = recordingContext();
    const beforeRenderer = new SceneRenderer(before, assets);
    const afterRenderer = new SceneRenderer(after, assets);

    beforeRenderer.render(viewModel({
      reelStopped: [false, true, true],
      reelOffsets: [17, 0, 0],
      reelCells: [
        ["coin", "moon", "crystal", "robot"],
        ["leaf", "leaf", "leaf", "leaf"],
        ["moon", "moon", "moon", "moon"],
      ],
    }));
    afterRenderer.render(viewModel({
      reelStopped: [false, true, true],
      reelOffsets: [18, 0, 0],
      reelCells: [
        ["robot", "coin", "moon", "crystal"],
        ["leaf", "leaf", "leaf", "leaf"],
        ["moon", "moon", "moon", "moon"],
      ],
    }));

    const beforeDraws = before.calls.filter((call) => call.name === "reel").slice(0, 4);
    const afterDraws = after.calls.filter((call) => call.name === "reel").slice(0, 4);
    expect(beforeDraws[0].args[0]).toBe(afterDraws[1].args[0]);
    expect(beforeDraws[0].args.at(-3)).toBe(71);
    expect(afterDraws[1].args.at(-3)).toBe(72);
  });

  it("tiles spinning symbols without vertical gaps inside each clipped reel", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({ reelStopped: [false, false, false], reelOffsets: [0, 0, 0] }));

    const firstReel = context.calls
      .filter((call) => call.name === "reel")
      .slice(0, 4)
      .map((call) => call.args.slice(-4));
    expect(firstReel).toEqual([
      [179, 54, 18, 18],
      [179, 72, 18, 18],
      [179, 90, 18, 18],
      [179, 108, 18, 18],
    ]);
  });

  it.each([
    ["coin", [[179, 82, 18, 18], [204, 82, 18, 18], [228, 82, 18, 18]]],
    ["leaf", [[177, 82, 18, 18], [202, 82, 18, 18], [226, 82, 18, 18]]],
    ["crystal", [[177, 82, 18, 18], [202, 82, 18, 18], [226, 82, 18, 18]]],
    ["moon", [[180, 82, 18, 18], [205, 82, 18, 18], [229, 82, 18, 18]]],
    ["robot", [[179, 81, 18, 18], [204, 81, 18, 18], [228, 81, 18, 18]]],
  ] satisfies ReadonlyArray<readonly [ReelSymbol, readonly (readonly number[])[]]>) (
    "optically centers every %s symbol consistently across all three reels",
    (symbol, expectedTargets) => {
      const context = recordingContext();
      const renderer = new SceneRenderer(context, assets);

      renderer.render(viewModel({ reels: [symbol, symbol, symbol] }));

      const reels = context.calls.filter((call) => call.name === "reel");
      expect(reels.map((call) => call.args.slice(-4))).toEqual(expectedTargets);

      for (let reelOffset = 0; reelOffset < 18; reelOffset += 1) {
        const spinningContext = recordingContext();
        const spinningRenderer = new SceneRenderer(spinningContext, assets);
        spinningRenderer.render(viewModel({
          reels: [symbol, symbol, symbol],
          reelCells: [
            [symbol, symbol, symbol, symbol],
            [symbol, symbol, symbol, symbol],
            [symbol, symbol, symbol, symbol],
          ],
          reelStopped: [false, false, false],
          reelOffsets: [reelOffset, reelOffset, reelOffset],
        }));

        const spinningReels = spinningContext.calls.filter((call) => call.name === "reel");
        expect(spinningReels).toHaveLength(12);
        for (let column = 0; column < 3; column += 1) {
          const columnDraws = spinningReels.slice(column * 4, column * 4 + 4);
          const columnYs = columnDraws.map((call) => call.args.at(-3) ?? Number.NaN);
          expect(columnDraws.map((call) => call.args.at(-4))).toEqual(
            Array(4).fill(expectedTargets[column][0]),
          );
          expect(columnYs.slice(1).map((value, index) => value - columnYs[index])).toEqual([
            18,
            18,
            18,
          ]);
          expect(Math.min(...columnYs)).toBeLessThanOrEqual(72);
          expect(Math.max(...columnYs) + 18).toBeGreaterThanOrEqual(109);
        }
      }
    },
  );

  it("clips stopped symbols to the perspective-aligned wells and uses runtime atlas cells", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({ reels: ["coin", "leaf", "moon"] }));

    const clips = context.calls.filter((call) => call.name === "rect");
    expect(clips.map((call) => call.args)).toEqual([
      [177, 72, 22, 37],
      [202, 72, 22, 37],
      [226, 72, 21, 37],
    ]);

    const reels = context.calls.filter((call) => call.name === "reel");
    expect(reels.map((call) => call.args.slice(0, 4))).toEqual([
      [0, 0, 18, 18],
      [18, 0, 18, 18],
      [54, 0, 18, 18],
    ]);
  });

  it("defaults a payout collectible to the generated scene's payout opening", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({ payoutCollectibleId: "plant" }));

    const payout = context.calls.find((call) => call.name === "payout");
    expect(payout?.args.slice(-4)).toEqual([181, 79, 64, 64]);
  });

  it("draws a placed collectible at its chosen tabletop pedestal at a readable scale", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({
      displayed: ["plant"],
      placements: [{ itemId: "plant", positionId: "right-rear-round" }],
    }));

    const displayed = context.calls.find((call) => call.name === "displayed");
    expect(displayed?.args.slice(-4)).toEqual([294, 94, 53, 53]);
  });

  it("rounds all canvas draw geometry to finite integers and never uses fractional scale", () => {
    const context = recordingContext();
    const renderer = new SceneRenderer(context, assets);

    renderer.render(viewModel({
      leverProgress: 0.333,
      reelOffsets: [1.25, 31.5, 62.75],
      reelStopped: [false, false, false],
      payoutCollectibleId: "moon-lamp",
      payoutPosition: { x: 172.25, y: 190.75 },
      displayed: ["plant", "crystal", "mini-robot"],
      coins: [{ x: 144.75, y: 128.125, startY: 200, size: 2.5 }],
      sparkles: [{ x: 99.9, y: 88.1, frame: 2.5 }],
      effects: {
        plantOffsetX: 0.5,
        moonGlow: 0.5,
        workingSweepX: 4.5,
        robotIndicator: true,
        collectibleBounce: { crystal: -2.25 },
        robotRetreatX: -3.75,
        crystalAlpha: 0.5,
      },
    }));

    const geometry = context.calls.flatMap((call) => call.args);
    expect(geometry.length).toBeGreaterThan(0);
    expect(geometry.every((value) => Number.isFinite(value) && Number.isInteger(value))).toBe(true);
    expect(context.calls.filter((call) => call.name === "scale").every(
      (call) => call.args.every(Number.isInteger),
    )).toBe(true);
  });

  it.each(["idle", "working", "completed", "error"] as const)(
    "draws %s agent lighting after scene content",
    (agentStatus: AgentStatus) => {
      const context = recordingContext();
      const renderer = new SceneRenderer(context, assets);

      renderer.render(viewModel({ agentStatus, displayed: ["plant"] }));

      const names = context.calls.map((call) => call.name);
      expect(firstIndex(names, "status")).toBeGreaterThan(lastIndex(names, "displayed"));
      expect(context.calls.filter((call) => call.name === "status")).not.toHaveLength(0);
    },
  );
});

function firstIndex(values: string[], value: string): number {
  return values.indexOf(value);
}

function lastIndex(values: string[], value: string): number {
  return values.lastIndexOf(value);
}

function indexes(calls: RecordedCall[], name: string): number[] {
  return calls.flatMap((call, index) => call.name === name ? [index] : []);
}

function recordingContext(): RecordingContext {
  const calls: RecordedCall[] = [];
  let fillStyle = "";

  const context = {
    calls,
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      fillStyle = String(value);
    },
    clearRect: (...args: number[]) => calls.push({ name: "clear", args }),
    drawImage: (image: CanvasImageSource, ...args: number[]) => {
      const kind = (image as unknown as { kind: string }).kind;
      let name = kind === "scene" ? "scene" : "reel";
      if (kind === "collectibles") {
        name = args.at(-1) === 64 ? "payout" : "displayed";
      }
      calls.push({ name, args });
    },
    save: () => calls.push({ name: "save", args: [] }),
    restore: () => calls.push({ name: "restore", args: [] }),
    beginPath: () => calls.push({ name: "beginPath", args: [] }),
    rect: (...args: number[]) => calls.push({ name: "rect", args }),
    clip: () => calls.push({ name: "clip", args: [] }),
    translate: (...args: number[]) => calls.push({ name: "translate", args }),
    rotate: (...args: number[]) => calls.push({ name: "rotate", args }),
    scale: (...args: number[]) => calls.push({ name: "scale", args }),
    fillRect: (...args: number[]) => calls.push({ name: classifyFill(fillStyle), args, style: fillStyle }),
  } as unknown as RecordingContext;

  return context;
}

function classifyFill(style: string): string {
  if (style === "#233255") return "star";
  if (style === "#18213c" || style === "#d48b2c") return "lever";
  if (style === "#e6a72e" || style === "#ffe074") return "coin";
  if (style === "#fff3b0") return "sparkle";
  if (style.startsWith("rgba(")) return "status";
  return "pixel";
}
