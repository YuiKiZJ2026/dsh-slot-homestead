import { useEffect, useRef, useState } from "react";
import type { EcosystemPlotId, GameState } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID, ECOSYSTEM_RESIDENTS } from "../ecosystem/catalog";
import { getJournalQuests, manorRank } from "../ecosystem/journal";
import { PanelHeader } from "./CollectionPanel";
import { ItemPortrait } from "./ItemPortrait";
import type { EcosystemAssetUrls } from "./EcosystemScene";
import { cropVisualStage, cropVisualStageLabel } from "../ecosystem/visual-stage";
import { worldView } from "../ecosystem/world-clock";

const TABS = [{ id: "today", label: "今日委托" }, { id: "milestones", label: "成长足迹" }, { id: "garden", label: "种植计划" }] as const;
export function HomesteadJournal({ open, state, date, disabled, error, onClose, onClaim, onPlant, onCancelPlanting, onHarvest, assetUrls, initialChapter = "today" }: {
  open: boolean; state: GameState; date: string; disabled: boolean; error: string | null;
  onClose(): void; onClaim(id: string): void; onPlant(plotId: EcosystemPlotId, seedId: string): void;
  onCancelPlanting?(plotId: EcosystemPlotId): void; onHarvest?(): void; assetUrls?: Partial<EcosystemAssetUrls>;
  initialChapter?: "today" | "garden";
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("today");
  const [selectedSeeds, setSelectedSeeds] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => { if (open) setTab(initialChapter); }, [open, initialChapter]);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); if (opener?.isConnected) opener.focus(); };
  }, [open]);
  if (!open) return null;
  const now = new Date(`${date}T12:00:00`);
  const quests = getJournalQuests(state, now);
  const rank = manorRank(state.ecosystem.journal?.xp ?? 0);
  const seeds = ECOSYSTEM_RESIDENTS.filter(item => item.habitat === "garden" && state.ecosystem.discovered.includes(item.id));
  const readyCrops = Object.values(state.ecosystem.lifecycle.plots).reduce((total, plot) => total + plot.readyYield, 0);
  return <section ref={panelRef} className="utility-panel homestead-journal" role="dialog" aria-label="庄园手账" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <PanelHeader title="庄园手账" closeLabel="合上庄园手账" onClose={onClose} />
    <div className="journal-rank">
      <span className="journal-rank__seal" aria-hidden="true">{rank.level}</span>
      <div><strong>{rank.title}</strong><small>{rank.next === null ? "每一次照料，都留在这里" : `${state.ecosystem.journal?.xp ?? 0} / ${rank.next} 成长点`}</small>
        <progress max={100} value={rank.progress} aria-label="庄园等级进度" /></div>
      <span className="journal-date">{state.ecosystem.world ? `第 ${worldView(state.ecosystem.world).day} 天` : date.slice(5).replace("-", " / ")}</span>
    </div>
    <nav className="journal-tabs" aria-label="手账章节">
      {TABS.map(item => <button type="button" key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>
    {tab === "garden" ? <>
      <p className="journal-note">播种用 1 份肥料；下一茬可随时撤销并退回肥料，不影响正在生长的作物。</p>
      <div className="journal-garden-tools"><span className="journal-supply">肥料 <strong>{state.ecosystem.supplies.fertilizer}</strong></span>
        {onHarvest ? <button type="button" className="pixel-button journal-harvest" aria-label="收获菜园成熟作物" disabled={disabled || readyCrops === 0} onClick={onHarvest}>{readyCrops > 0 ? `收获 ${readyCrops} 份` : "等待成熟"}</button> : null}
      </div>
      <div className="journal-plots">
        {Object.entries(state.ecosystem.lifecycle.plots).map(([id, plot]) => {
          const selectedSeed = selectedSeeds[id] ?? seeds[0]?.id ?? "";
          const occupied = plot.growth > 0 || plot.readyYield > 0;
          return <div key={id} className="journal-plot" data-plot-plan={id} data-ripe={plot.readyYield > 0}>
            <div className="journal-plot__identity">
              {plot.seedId ? <ItemPortrait itemId={plot.seedId} assetUrls={assetUrls} frame={cropVisualStage(plot.growth, plot.readyYield).frame} size={40} decorative={false} label={`田地${id}作物预览`} /> : <span className="journal-plot__empty" aria-hidden="true">{id}</span>}
              <div className="journal-plot__heading"><span>田地 {id}</span><strong>{plot.seedId ? ECOSYSTEM_ITEM_BY_ID[plot.seedId]?.name.replace("种子", "") : "空地"}</strong></div>
            </div>
            <progress value={plot.growth} max={100} aria-label={`田地${id}成长`} />
            <small>{plot.nextSeedId ? `下一茬：${ECOSYSTEM_ITEM_BY_ID[plot.nextSeedId]?.name.replace("种子", "")}` : plot.readyYield > 0 ? `成熟了 · 可收获 ${plot.readyYield} 份` : plot.seedId ? `${cropVisualStageLabel(plot.growth, plot.readyYield)} ${Math.round(plot.growth)}% · 第 ${plot.generation} 茬` : "选择一颗种子"}</small>
            <div className="journal-plot__actions">
              <select aria-label={`田地${id}种子`} value={selectedSeed} disabled={disabled || !!plot.nextSeedId} onChange={event => setSelectedSeeds(current => ({ ...current, [id]: event.target.value }))}>
                {seeds.map(seed => <option value={seed.id} key={seed.id}>{seed.name.replace("种子", "")}</option>)}
              </select>
              <button type="button" className="pixel-button" aria-label={`播种田地${id}`} disabled={disabled || !!plot.nextSeedId || !selectedSeed || plot.seedId === selectedSeed || state.ecosystem.supplies.fertilizer < 1} onClick={() => onPlant(id as EcosystemPlotId, selectedSeed)}>{occupied ? "下茬" : "播种"}</button>
            </div>
            {plot.nextSeedId && onCancelPlanting ? <button type="button" className="journal-cancel-plan" aria-label={`撤销田地${id}下一茬`} disabled={disabled} onClick={() => onCancelPlanting(id as EcosystemPlotId)}>撤销预约 · 退回肥料</button> : null}
          </div>;
        })}
      </div>
    </> : <>
      <p className="journal-note">{tab === "today" ? `顺手照顾小世界，收下今天的小惊喜。每日委托按${state.ecosystem.world ? "庄园天数" : "系统日期"}更新。` : "不着急，庄园会一点一点长大。每个足迹奖励只领取一次。"}</p>
      <ul className="journal-quests">
        {quests.filter(quest => quest.daily === (tab === "today")).map(quest => {
          const ready = quest.progress >= quest.target;
          const rewards = [quest.coins ? `${quest.coins} 硬币` : "", ...Object.entries(quest.supplies).map(([key, count]) => `${({ fishFeed: "鱼食", fertilizer: "肥料", animalFeed: "饲料" } as Record<string, string>)[key]} ×${count}`), `${quest.xp} 成长点`].filter(Boolean).join(" · ");
          return <li key={quest.id} className="journal-quest" data-quest={quest.id} data-complete={quest.claimed}>
            <div className="journal-quest__body"><strong>{quest.title}</strong><p>{quest.description} <span>{quest.progress} / {quest.target}</span></p>
              <progress max={quest.target} value={quest.progress} aria-label={`${quest.title}进度`} />
              <small>{rewards}</small></div>
            <button type="button" className="pixel-button" disabled={disabled || !ready || quest.claimed} aria-label={`${quest.claimed ? "已领取" : "领取"}${quest.title}`} onClick={() => onClaim(quest.id)}>{quest.claimed ? "已记下 ✓" : ready ? "收下奖励" : "进行中"}</button>
          </li>;
        })}
      </ul>
    </>}
    {error ? <p className="journal-error" role="alert">{({ "quest-unavailable": "这个奖励尚未完成，或已经领取。", "no-planting-plan": "这块田没有预约下一茬。", "plot-occupied": "这块地已经有相同作物或下一茬计划。", "no-supply": "肥料不足，可以到工坊补给。", "revision-conflict": "庄园状态刚刚更新，请再试一次。", "clock-skew": "系统日期早于上次记录，今天的奖励暂不可领取。" } as Record<string, string>)[error] ?? error}</p> : null}
    <footer className="journal-footer">照料不赶时间 · 离开后也会自然成长</footer>
  </section>;
}
