import { useEffect, useRef, useState } from "react";
import type { GameState } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID } from "../ecosystem/catalog";

type Feedback = { kind: "harvest" | "reward" | "plant" | "care" | "growth" | "purchase" | "trade"; title: string; detail: string };
const sum = (values: Record<string, number>) => Object.values(values).reduce((total, value) => total + value, 0);

/** Derived from accepted state, never from a click or an optimistic balance. */
export function describeHomesteadChange(before: GameState, after: GameState): Feedback | null {
  if (after.revision < before.revision) return null;
  const previous = before.ecosystem;
  const next = after.ecosystem;
  const coins = after.wallet - before.wallet;
  const walletChange = coins === 0 ? "" : ` · 钱包净变化 ${coins > 0 ? "+" : "−"}${Math.abs(coins)}`;
  if (next.merchant) {
    const last = previous.merchant?.visitId === next.merchant.visitId ? previous.merchant : undefined;
    const sales = next.merchant.soldCount - (last?.soldCount ?? 0);
    const purchases = sum(next.merchant.purchased) - (last ? sum(last.purchased) : 0);
    if (sales > 0 || purchases > 0) return {kind:"trade",title:"商人交易完成",detail:[sales>0 ? `出售 ${sales} 份收成` : "",purchases>0 ? `购入 ${purchases} 件货品` : ""].filter(Boolean).join(" · ")+walletChange};
  }
  const harvested = sum(next.lifecycle.produce) - sum(previous.lifecycle.produce);
  if (harvested > 0) return { kind: "harvest", title: "收获已入账", detail: `${harvested} 份产物${walletChange}` };
  const xp = (next.journal?.xp ?? 0) - (previous.journal?.xp ?? 0);
  if (xp > 0) return { kind: "reward", title: "手账奖励已收下", detail: `+${xp} 成长点${walletChange}` };
  const discovered = next.discovered.filter(id => !previous.discovered.includes(id));
  if (discovered.length) return { kind: "purchase", title: "庄园添了新伙伴", detail: discovered.map(id => ECOSYSTEM_ITEM_BY_ID[id]?.name ?? id).join("、") };
  const collectible = after.ownedCollectibles.length - before.ownedCollectibles.length;
  if (collectible > 0) return { kind: "purchase", title: "新摆件已收进收藏盒", detail: "打开收藏盒，把它摆上桌吧" };
  for (const [id, plot] of Object.entries(next.lifecycle.plots)) {
    const old = previous.lifecycle.plots[id as keyof typeof previous.lifecycle.plots];
    if (!old) continue;
    if (old.nextSeedId && !plot.nextSeedId && old.seedId === plot.seedId && old.generation === plot.generation) {
      const refund = next.supplies.fertilizer - previous.supplies.fertilizer;
      return { kind: "plant", title: "下一茬计划已撤销", detail: `${refund === 1 ? "肥料 +1" : `肥料余量 ${next.supplies.fertilizer}`} · 当前作物继续生长` };
    }
    if (plot.nextSeedId && plot.nextSeedId !== old.nextSeedId) return { kind: "plant", title: `田地 ${id} 已安排下一茬`, detail: "收获后自动换种，当前作物不会丢失" };
    if (plot.seedId && plot.seedId !== old.seedId) return { kind: "plant", title: `田地 ${id} 播种完成`, detail: `${ECOSYSTEM_ITEM_BY_ID[plot.seedId]?.name.replace("种子", "") ?? "新作物"}开始生长 · 肥料 −1` };
  }
  const newlyReady = Object.entries(next.lifecycle.plots).filter(([id, plot]) => plot.readyYield > 0 && (previous.lifecycle.plots[id as keyof typeof previous.lifecycle.plots]?.readyYield ?? 0) === 0).length;
  if (newlyReady) return { kind: "growth", title: "菜园有新收成", detail: `${newlyReady} 块田成熟了 · 打开菜园收获` };
  const adults = Object.entries(next.lifecycle.fish).filter(([id, fish]) => fish.growth >= 100 && (previous.lifecycle.fish[id]?.growth ?? 0) < 100).length;
  if (adults) return { kind: "growth", title: "小鱼长大了", detail: `${adults} 种鱼进入成年期 · 去手账看看成长足迹` };
  if (coins < 0 && ["fishFeed", "fertilizer", "animalFeed"].some(key => next.supplies[key as keyof typeof next.supplies] > previous.supplies[key as keyof typeof previous.supplies])) return { kind: "purchase", title: "补给已放好", detail: `钱包净变化 −${Math.abs(coins)} · 补给数量已更新` };
  const boosts = (lives: Record<string, { boostedUntil: string | null }>) => Object.values(lives).reduce((latest, life) => Math.max(latest, life.boostedUntil ? Date.parse(life.boostedUntil) || 0 : 0), 0);
  for (const [key, habitat, collection, title] of [["fishFeed", "aquarium", "fish", "鱼食已投下"], ["fertilizer", "garden", "plots", "肥料已施入"], ["animalFeed", "animals", "livestock", "饲料已添好"]] as const) {
    const boostChanged = boosts(next.lifecycle[collection]) > boosts(previous.lifecycle[collection]);
    const careRecorded = next.journal?.care.includes(habitat) && (!previous.journal?.care.includes(habitat) || previous.journal.day !== next.journal.day);
    if (next.supplies[key] < previous.supplies[key] && (boostChanged || careRecorded)) return { kind: "care", title, detail: "照料已记录 · 居民已得到照顾" };
  }
  return null;
}

export function HomesteadFeedback({ state, ready }: { state: GameState; ready: boolean }) {
  const previous = useRef<GameState | null>(null);
  const sequence = useRef(0);
  const [feedback, setFeedback] = useState<(Feedback & { sequence: number }) | null>(null);
  useEffect(() => {
    if (!ready) { previous.current = null; setFeedback(null); return; }
    const message = previous.current ? describeHomesteadChange(previous.current, state) : null;
    previous.current = state;
    if (message) setFeedback({ ...message, sequence: ++sequence.current });
  }, [state, ready]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4200);
    return () => clearTimeout(timer);
  }, [feedback]);
  return <div className="homestead-feedback-region" aria-live="polite" aria-atomic="true">
    {feedback ? <div key={feedback.sequence} className="homestead-feedback" data-testid="homestead-feedback" data-feedback-kind={feedback.kind} data-reduced-motion={state.settings.reducedMotion}>
      <span className="homestead-feedback__mark" aria-hidden="true">✓</span>
      <span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
    </div> : null}
  </div>;
}
