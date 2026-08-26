import { COLLECTIBLES } from "../../domain/catalog";
import type { AgentStatus, ReelSymbol } from "../../domain/types";
import type { SceneViewModel } from "./animation";
import { ASSET_FRAMES, DISPLAY_SLOTS, type AtlasFrame, type SceneAssets } from "./assets";

const CANVAS_WIDTH = 384;
const CANVAS_HEIGHT = 288;
const REEL_WINDOWS = [
  { x: 177, y: 72, width: 22, height: 37 },
  { x: 202, y: 72, width: 22, height: 37 },
  { x: 226, y: 72, width: 21, height: 37 },
] as const;

const REEL_SYMBOL_SIZE = 18;
const REEL_SYMBOL_STEP = REEL_SYMBOL_SIZE;
const REEL_SYMBOL_OPTICAL_OFFSETS: Readonly<Record<ReelSymbol, { x: number; y: number }>> = {
  coin: { x: 0, y: 0 },
  leaf: { x: -2, y: 0 },
  crystal: { x: -2, y: 0 },
  moon: { x: 1, y: 0 },
  robot: { x: 0, y: -1 },
};

const STAR_PIXELS = [
  [18, 36], [52, 24], [89, 48], [306, 31], [348, 52], [366, 18],
] as const;

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "rgba(255,184,80,0.18)",
  working: "rgba(65,225,211,0.34)",
  completed: "rgba(255,214,92,0.34)",
  error: "rgba(255,91,91,0.36)",
};

export class SceneRenderer {
  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly assets: SceneAssets,
  ) {
    this.context.imageSmoothingEnabled = false;
  }

  render(viewModel: SceneViewModel): void {
    const context = this.context;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (viewModel.starryTheme) this.drawStarryDesktop();
    context.drawImage(this.assets.scene, 0, 0);
    this.drawReels(viewModel);
    this.drawLever(viewModel.leverProgress);
    this.drawDisplayedCollectibles(viewModel);
    this.drawPayoutCollectible(viewModel);
    this.drawCoins(viewModel.coins);
    this.drawSparkles(viewModel.sparkles);
    this.drawAgentLighting(viewModel);
  }

  private drawStarryDesktop(): void {
    this.context.fillStyle = "#233255";
    for (const [x, y] of STAR_PIXELS) this.context.fillRect(x, y, 2, 2);
  }

  private drawReels(viewModel: SceneViewModel): void {
    for (let index = 0; index < REEL_WINDOWS.length; index += 1) {
      const window = REEL_WINDOWS[index];
      const symbol = viewModel.reels[index];
      const offset = positiveModulo(pixel(viewModel.reelOffsets[index]), REEL_SYMBOL_STEP);
      this.context.save();
      this.context.beginPath();
      this.context.rect(window.x, window.y, window.width, window.height);
      this.context.clip();
      if (viewModel.reelStopped[index]) {
        const frame = ASSET_FRAMES.reels[symbol];
        const opticalOffset = REEL_SYMBOL_OPTICAL_OFFSETS[symbol];
        const symbolX = Math.round(window.x + window.width / 2 - REEL_SYMBOL_SIZE / 2 + opticalOffset.x);
        const symbolY = window.y + Math.round((window.height - REEL_SYMBOL_SIZE) / 2) + opticalOffset.y;
        this.drawAtlasFrame(
          this.assets.reels,
          frame,
          symbolX,
          symbolY,
          REEL_SYMBOL_SIZE,
          REEL_SYMBOL_SIZE,
        );
      } else {
        for (const [cellIndex, step] of [-1, 0, 1, 2].entries()) {
          const cellSymbol = viewModel.reelCells[index][cellIndex];
          const frame = ASSET_FRAMES.reels[cellSymbol];
          const opticalOffset = REEL_SYMBOL_OPTICAL_OFFSETS[cellSymbol];
          const symbolX = Math.round(window.x + window.width / 2 - REEL_SYMBOL_SIZE / 2 + opticalOffset.x);
          this.drawAtlasFrame(
            this.assets.reels,
            frame,
            symbolX,
            window.y + offset + step * REEL_SYMBOL_STEP + opticalOffset.y,
            REEL_SYMBOL_SIZE,
            REEL_SYMBOL_SIZE,
          );
        }
      }
      this.context.restore();
    }
  }

  private drawLever(progress: number): void {
    const drop = pixel(clamp01(progress) * 18);
    this.context.fillStyle = "#18213c";
    this.context.fillRect(278, 87 + drop, 5, 34);
    this.context.fillRect(275, 84 + drop, 11, 8);
    this.context.fillStyle = "#d48b2c";
    this.context.fillRect(279, 88 + drop, 3, 31);
    this.context.fillRect(277, 85 + drop, 7, 6);
  }

  private drawDisplayedCollectibles(viewModel: SceneViewModel): void {
    for (const id of viewModel.displayed) {
      const catalogIndex = COLLECTIBLES.findIndex((item) => item.id === id);
      const frame = ASSET_FRAMES.collectibles[id];
      const slot = DISPLAY_SLOTS[catalogIndex];
      if (catalogIndex < 0 || frame === undefined || slot === undefined) continue;
      const offsetX = id === "plant" ? viewModel.effects?.plantOffsetX ?? 0 :
        id === "mini-robot" ? viewModel.effects?.robotRetreatX ?? 0 : 0;
      const offsetY = viewModel.effects?.collectibleBounce[id] ?? 0;
      const previousAlpha = this.context.globalAlpha;
      if (id === "crystal") this.context.globalAlpha = clamp01(viewModel.effects?.crystalAlpha ?? 1);
      if (id === "moon-lamp" && (viewModel.effects?.moonGlow ?? 0) > 0) {
        this.context.globalAlpha = clamp01((viewModel.effects?.moonGlow ?? 0) * 0.3);
        this.drawAtlasFrame(
          this.assets.collectibles,
          frame,
          pixel(slot.x - 17 + offsetX),
          pixel(slot.y - 33 + offsetY),
          34,
          34,
        );
        this.context.globalAlpha = previousAlpha;
      }
      this.drawAtlasFrame(
        this.assets.collectibles,
        frame,
        pixel(slot.x - 16 + offsetX),
        pixel(slot.y - 32 + offsetY),
        32,
        32,
      );
      this.context.globalAlpha = previousAlpha;
    }
  }

  private drawPayoutCollectible(viewModel: SceneViewModel): void {
    if (viewModel.payoutCollectibleId === null) return;
    const frame = ASSET_FRAMES.collectibles[viewModel.payoutCollectibleId];
    if (frame === undefined) return;
    const position = viewModel.payoutPosition ?? { x: 213, y: 143 };
    this.drawAtlasFrame(
      this.assets.collectibles,
      frame,
      pixel(position.x - 18),
      pixel(position.y - 36),
      36,
      36,
    );
  }

  private drawCoins(coins: SceneViewModel["coins"]): void {
    for (const coin of coins) {
      const size = Math.max(1, pixel(coin.size, 1));
      const x = pixel(coin.x);
      const y = pixel(coin.y);
      this.context.fillStyle = "#e6a72e";
      this.context.fillRect(x, y, size, size);
      this.context.fillStyle = "#ffe074";
      this.context.fillRect(x, y, Math.max(1, size - 1), 1);
    }
  }

  private drawSparkles(sparkles: SceneViewModel["sparkles"]): void {
    this.context.fillStyle = "#fff3b0";
    for (const sparkle of sparkles.slice(0, 6)) {
      const x = pixel(sparkle.x);
      const y = pixel(sparkle.y);
      const arm = Math.max(1, positiveModulo(pixel(sparkle.frame), 3) + 1);
      this.context.fillRect(x - arm, y, arm * 2 + 1, 1);
      this.context.fillRect(x, y - arm, 1, arm * 2 + 1);
    }
  }

  private drawAgentLighting(viewModel: SceneViewModel): void {
    this.context.fillStyle = STATUS_COLORS[viewModel.agentStatus];
    this.context.fillRect(172, 48, 91, 5);
    if (viewModel.agentStatus === "working") {
      const sweepX = pixel(viewModel.effects?.workingSweepX ?? 0);
      this.context.fillRect(172 + positiveModulo(sweepX, 42), 48, 3, 5);
      if (viewModel.effects?.robotIndicator) this.context.fillRect(258, 50, 3, 2);
    }
  }

  private drawAtlasFrame(
    image: HTMLImageElement,
    frame: AtlasFrame,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.context.drawImage(
      image,
      pixel(frame.x),
      pixel(frame.y),
      pixel(frame.width),
      pixel(frame.height),
      pixel(x),
      pixel(y),
      Math.max(1, pixel(width, 1)),
      Math.max(1, pixel(height, 1)),
    );
  }
}

function pixel(value: number, fallback = 0): number {
  return Math.round(Number.isFinite(value) ? value : fallback);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
