import { COLLECTIBLES } from "../domain/catalog";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "../domain/types";
import { isCollectibleLockedByActiveSpin } from "../inventory/inventory";
import { ECOSYSTEM_RESIDENTS, ECOSYSTEM_SUPPLIES } from "../ecosystem/catalog";
import { isEcosystemItemLockedByActiveSpin } from "../ecosystem/ecosystem";
import { CollectibleSprite, PanelHeader } from "./CollectionPanel";
import { ItemPortrait } from "./ItemPortrait";
import type { EcosystemAssetUrls } from "./EcosystemScene";
import { WORKSHOP_STYLE } from "../ui/workshop-style";

type ShopCategory = "all" | "decor" | "residents" | "supplies";
const SHOP_CATEGORIES: readonly { id: ShopCategory; label: string }[] = [
  { id: "all", label: "全部" }, { id: "decor", label: "摆件" },
  { id: "residents", label: "居民" }, { id: "supplies", label: "补给" },
];
const HABITAT_LABELS = { aquarium: "鱼缸", garden: "种植园", animals: "牧场" } as const;
const GROWTH_LABELS = {
  aquarium: ["鱼苗", "幼鱼", "青年鱼", "成鱼"],
  garden: ["萌芽", "展叶", "挂果", "成熟"],
  animals: ["幼崽", "青年", "成年"],
} as const;

export interface ShopPanelProps {
  open: boolean;
  state: GameState;
  onClose(): void;
  onBuy(id: string): void;
  mutationsDisabled?: boolean;
  collectiblesUrl?: string;
  assetUrls?: Partial<EcosystemAssetUrls>;
}

export function ShopPanel({
  open,
  state,
  onClose,
  onBuy,
  mutationsDisabled = false,
  collectiblesUrl,
  assetUrls,
}: ShopPanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ShopCategory>("all");
  const [growthReference, setGrowthReference] = useState<{ itemId: string; frame: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLDivElement>(null);
  const referenceOpenerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCategory("all");
    }
  }, [open]);
  useEffect(() => { setGrowthReference(null); }, [open, category, query]);
  useEffect(() => {
    if (growthReference !== null) {
      referenceRef.current?.focus({ preventScroll: true });
      referenceRef.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
    }
  }, [growthReference?.itemId]);
  if (!open) return null;

  const search = query.trim().toLocaleLowerCase();
  const matches = (item: { name: string; habitat?: keyof typeof HABITAT_LABELS }) =>
    `${item.name} ${item.habitat ? HABITAT_LABELS[item.habitat] : "摆件"}`.toLocaleLowerCase().includes(search);
  const showDecor = category === "all" || category === "decor";
  const showResidents = category === "all" || category === "residents";
  const showSupplies = category === "all" || category === "supplies";
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    searchRef.current?.focus();
  };

  const owned = new Set(state.ownedCollectibles);
  const craftable = showDecor ? COLLECTIBLES.filter((item) => item.rarity === "common" && matches(item)) : [];
  const discoveries = showDecor ? COLLECTIBLES.filter((item) => item.rarity !== "common" && matches(item)) : [];
  const residents = showResidents ? ECOSYSTEM_RESIDENTS.filter(matches) : [];
  const supplies = showSupplies ? ECOSYSTEM_SUPPLIES.filter(matches) : [];
  const resultCount = craftable.length + discoveries.length + residents.length + supplies.length;
  const starryProgress = COLLECTIBLES.filter((item) => item.rarity === "set" && owned.has(item.id)).length;
  return (
    <section className="utility-panel shop-panel" role="dialog" aria-label="像素工坊">
      <style>{WORKSHOP_STYLE}</style>
      <PanelHeader title="像素工坊" closeLabel="关闭像素工坊" onClose={onClose} />
      <p className="panel-wallet">可用硬币：{state.wallet} 枚</p>
      <div className="shop-tools">
        <div className="shop-categories" role="group" aria-label="工坊分类">
          {SHOP_CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
        </div>
        <div className="shop-search-field">
          <label className="shop-search"><span className="visually-hidden">搜索工坊</span><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜名字或所在场景" /></label>
          {query !== "" ? <button className="shop-search-clear" type="button" aria-label="清空搜索" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>×</button> : null}
        </div>
      </div>
      <p className="shop-result-count" role="status" aria-live="polite">{resultCount > 0 ? `${resultCount} 件${search ? ` · 与「${query.trim()}」相关` : ""}` : "没有找到，试试「鱼」「种子」或「肥料」。"}</p>
      {resultCount === 0 ? <div className="shop-empty"><p>可以清空关键词，或换个分类继续逛。</p><button type="button" className="pixel-button pixel-button--compact" onClick={resetFilters}>查看全部物品</button></div> : null}
      {craftable.length > 0 ? <><h3 className="workshop-section-title">常驻制作</h3>
      <ul className="collectible-list" aria-label="常驻制作">
        {craftable.map((item) => {
          const isOwned = owned.has(item.id);
          const isLockedReward = isCollectibleLockedByActiveSpin(state, item.id);
          const affordable = state.wallet >= item.price;
          const label = isLockedReward
            ? `待领取 ${item.name}`
            : isOwned
            ? `已拥有 ${item.name}`
            : affordable
              ? `购买 ${item.name}`
              : `余额不足 ${item.name}`;
          return (
            <li className="collectible-row" key={item.id}>
              <CollectibleSprite item={item} owned imageUrl={collectiblesUrl} />
              <span className="collectible-row__copy">
                <strong>{item.name}</strong>
                <small data-testid={`shop-price-${item.id}`}>{item.price} 枚</small>
              </span>
              <button
                type="button"
                className="pixel-button pixel-button--compact"
                disabled={mutationsDisabled || isLockedReward || isOwned || !affordable}
                aria-label={label}
                onClick={() => onBuy(item.id)}
              >
                {isLockedReward ? "待领取" : isOwned ? "已拥有" : affordable ? "购买" : "余额不足"}
              </button>
            </li>
          );
        })}
      </ul></> : null}
      {residents.length > 0 ? <><h3 className="workshop-section-title">生态居民</h3>
      <p className="shop-reference-note">点击图片查看成长图鉴。图示为成熟外观，购入后仍需照料。</p>
      <ul className="collectible-list ecosystem-shop-list" aria-label="生态居民">
        {residents.map((item) => {
          const isOwned = state.ecosystem.discovered.includes(item.id);
          const isLockedReward = isEcosystemItemLockedByActiveSpin(state, item.id);
          const affordable = state.wallet >= item.price;
          const label = isLockedReward
            ? `待领取 ${item.name}`
            : isOwned
              ? `已拥有 ${item.name}`
              : affordable ? `购买 ${item.name}` : `余额不足 ${item.name}`;
          return (
            <li className={`collectible-row ecosystem-shop-row ecosystem-shop-row--${item.habitat}`} key={item.id} data-reference-open={growthReference?.itemId === item.id}>
              <button
                type="button"
                className="shop-portrait-toggle"
                aria-label={`查看${item.name}成长图鉴`}
                aria-expanded={growthReference?.itemId === item.id}
                aria-controls={growthReference?.itemId === item.id ? `shop-growth-${item.id}` : undefined}
                onClick={event => {
                  referenceOpenerRef.current = event.currentTarget;
                  setGrowthReference(current => current?.itemId === item.id ? null : { itemId: item.id, frame: 0 });
                }}
              ><ItemPortrait itemId={item.id} assetUrls={assetUrls} /><span className="shop-portrait-toggle__hint" aria-hidden="true">图鉴</span></button>
              <span className="ecosystem-shop-row__copy">
                <strong>{item.name}</strong>
                <small>{item.price} 枚 · {item.habitat === "aquarium" ? "鱼缸" : item.habitat === "garden" ? "种植园" : "牧场"}</small>
              </span>
              <button
                type="button"
                className="pixel-button pixel-button--compact"
                disabled={mutationsDisabled || isLockedReward || isOwned || !affordable}
                aria-label={label}
                onClick={() => onBuy(item.id)}
              >{isLockedReward ? "待领取" : isOwned ? "已拥有" : affordable ? "购买" : "余额不足"}</button>
              {growthReference?.itemId === item.id ? <div
                ref={referenceRef}
                className="shop-growth-reference"
                id={`shop-growth-${item.id}`}
                role="region"
                aria-label={`${item.name}成长图鉴`}
                tabIndex={-1}
              >
                <button type="button" className="shop-growth-reference__close" aria-label={`关闭${item.name}成长图鉴`} onClick={() => { setGrowthReference(null); referenceOpenerRef.current?.focus(); }}>×</button>
                <div className="shop-growth-reference__preview">
                  <ItemPortrait itemId={item.id} assetUrls={assetUrls} size={72} frame={growthReference.frame} decorative={false} label={`${item.name}：${GROWTH_LABELS[item.habitat][growthReference.frame]}（外观参考）`} />
                  <div><strong aria-live="polite">{item.name} · {GROWTH_LABELS[item.habitat][growthReference.frame]}</strong><p>成长阶段的外观参考，不代表当前养成进度。</p></div>
                </div>
                <div className="shop-growth-reference__stages" role="group" aria-label={`${item.name}成长阶段`}>
                  {GROWTH_LABELS[item.habitat].map((stage, frame) => <button type="button" key={stage} aria-pressed={growthReference.frame === frame} onClick={() => setGrowthReference({ itemId: item.id, frame })}>{stage}</button>)}
                </div>
              </div> : null}
            </li>
          );
        })}
      </ul></> : null}
      {supplies.length > 0 ? <><h3 className="workshop-section-title">饲料与肥料</h3>
      <ul className="collectible-list ecosystem-shop-list" aria-label="饲料与肥料">
        {supplies.map((item) => {
          const affordable = state.wallet >= item.price;
          const count = state.ecosystem.supplies[item.supplyKey!];
          return (
            <li className="collectible-row ecosystem-shop-row ecosystem-shop-row--supply" key={item.id}>
              <span className="ecosystem-shop-row__copy">
                <strong>{item.name}</strong>
                <small>{item.price} 枚 · 现有 {count}</small>
              </span>
              <button
                type="button"
                className="pixel-button pixel-button--compact"
                disabled={mutationsDisabled || !affordable}
                aria-label={affordable ? `购买 ${item.name}` : `余额不足 ${item.name}`}
                onClick={() => onBuy(item.id)}
              >{affordable ? "购买" : "余额不足"}</button>
            </li>
          );
        })}
      </ul></> : null}
      {discoveries.length > 0 ? <><h3 className="workshop-section-title">稀有发现</h3>
      <ul className="collectible-list collectible-list--discoveries" aria-label="稀有发现">
        {discoveries.map((item) => (
          <li className="collectible-row collectible-row--discovery" key={item.id}>
            <CollectibleSprite item={item} owned={owned.has(item.id)} imageUrl={collectiblesUrl} />
            <span className="collectible-row__copy">
              <strong>{item.name}</strong>
              <small>{owned.has(item.id) ? "已经发现" : "通过拉杆或保底发现"}</small>
            </span>
            <span className="discovery-status">{owned.has(item.id) ? "已收录" : "待发现"}</span>
          </li>
        ))}
      </ul></> : null}
      <section className="workshop-upgrade" role="region" aria-label="星夜改装进度">
        <strong>星夜改装 {starryProgress} / 3</strong>
        <span>{starryProgress === 3 ? "星夜桌面已启用" : "完成星夜观测套装自动解锁星夜桌面"}</span>
        <progress max={3} value={starryProgress} aria-label="星夜改装进度" />
      </section>
    </section>
  );
}
