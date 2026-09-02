import { CATALOG_BY_ID } from "../domain/catalog";
import { closestCollectibleCombo } from "../domain/collectible-combos";
import type { GameState } from "../domain/types";

const TOKEN_PER_COIN = 10_000;
const PITY_LIMIT = 10;
const STARRY_IDS = ["star-projector", "constellation-globe", "comet-badge"] as const;

export function CurrentGoal({
  state,
  tokenProgress,
}: {
  state: GameState;
  tokenProgress?: number;
}) {
  const goal = goalFor(state, tokenProgress);
  return (
    <section className="current-goal" role="region" aria-label="当前目标">
      <span className="current-goal__eyebrow">当前目标</span>
      <strong>{goal.title}</strong>
      <span>{goal.detail}</span>
      <progress
        aria-label={goal.progressLabel}
        aria-valuemax={goal.max}
        aria-valuemin={0}
        aria-valuenow={goal.value}
        max={goal.max}
        value={goal.value}
      />
    </section>
  );
}

function goalFor(state: GameState, tokenProgress?: number) {
  if (state.wallet === 0 && tokenProgress !== undefined) {
    const progress = clamp(tokenProgress, 0, TOKEN_PER_COIN);
    return {
      title: "下一枚硬币",
      detail: `${progress.toLocaleString("zh-CN")} / 10,000 实际 Token`,
      progressLabel: "下一枚硬币进度",
      value: progress,
      max: TOKEN_PER_COIN,
    };
  }

  if (state.pityMisses > 0) {
    const misses = clamp(state.pityMisses, 0, PITY_LIMIT);
    return {
      title: "保底进度",
      detail: `${misses} / ${PITY_LIMIT} · 再 ${PITY_LIMIT - misses} 次未获新收藏触发保底`,
      progressLabel: "保底进度",
      value: misses,
      max: PITY_LIMIT,
    };
  }

  const combo = closestCollectibleCombo(state);
  if (combo !== null && combo.displayedCount > 0) {
    const missingNames = combo.missingItemIds
      .map((id) => CATALOG_BY_ID[id]?.name ?? id)
      .join("、");
    return {
      title: `点亮${combo.combo.name}`,
      detail: `${combo.displayedCount} / ${combo.totalCount} · 还需要${missingNames}`,
      progressLabel: `${combo.combo.name}组合进度`,
      value: combo.displayedCount,
      max: combo.totalCount,
    };
  }

  const starryProgress = STARRY_IDS.filter((id) => state.ownedCollectibles.includes(id)).length;
  return {
    title: "收集星夜观测",
    detail: `${starryProgress} / ${STARRY_IDS.length} · 集齐后解锁星夜桌面`,
    progressLabel: "星夜观测收集进度",
    value: starryProgress,
    max: STARRY_IDS.length,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
