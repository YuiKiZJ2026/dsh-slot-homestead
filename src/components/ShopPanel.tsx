import { COLLECTIBLES } from "../domain/catalog";
import type { GameState } from "../domain/types";
import { isCollectibleLockedByActiveSpin } from "../inventory/inventory";
import { ECOSYSTEM_RESIDENTS, ECOSYSTEM_SUPPLIES } from "../ecosystem/catalog";
import { isEcosystemItemLockedByActiveSpin } from "../ecosystem/ecosystem";
import { CollectibleSprite, PanelHeader } from "./CollectionPanel";

export interface ShopPanelProps {
  open: boolean;
  state: GameState;
  onClose(): void;
  onBuy(id: string): void;
  mutationsDisabled?: boolean;
  collectiblesUrl?: string;
}

export function ShopPanel({
  open,
  state,
  onClose,
  onBuy,
  mutationsDisabled = false,
  collectiblesUrl,
}: ShopPanelProps) {
  if (!open) return null;

  const owned = new Set(state.ownedCollectibles);
  const craftable = COLLECTIBLES.filter((item) => item.rarity === "common");
  const discoveries = COLLECTIBLES.filter((item) => item.rarity !== "common");
  const starryProgress = discoveries.filter((item) => item.rarity === "set" && owned.has(item.id)).length;
  return (
    <section className="utility-panel shop-panel" role="dialog" aria-label="像素工坊">
      <PanelHeader title="像素工坊" closeLabel="关闭像素工坊" onClose={onClose} />
      <p className="panel-wallet">可用硬币：{state.wallet} 枚</p>
      <h3 className="workshop-section-title">常驻制作</h3>
      <ul className="collectible-list">
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
      </ul>
      <h3 className="workshop-section-title">生态居民</h3>
      <ul className="collectible-list ecosystem-shop-list">
        {ECOSYSTEM_RESIDENTS.map((item) => {
          const isOwned = state.ecosystem.discovered.includes(item.id);
          const isLockedReward = isEcosystemItemLockedByActiveSpin(state, item.id);
          const affordable = state.wallet >= item.price;
          const label = isLockedReward
            ? `待领取 ${item.name}`
            : isOwned
              ? `已拥有 ${item.name}`
              : affordable ? `购买 ${item.name}` : `余额不足 ${item.name}`;
          return (
            <li className={`collectible-row ecosystem-shop-row ecosystem-shop-row--${item.habitat}`} key={item.id}>
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
            </li>
          );
        })}
      </ul>
      <h3 className="workshop-section-title">饲料与肥料</h3>
      <ul className="collectible-list ecosystem-shop-list">
        {ECOSYSTEM_SUPPLIES.map((item) => {
          const affordable = state.wallet >= item.price;
          const count = state.ecosystem.supplies[item.supplyKey!];
          return (
            <li className="collectible-row ecosystem-shop-row" key={item.id}>
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
      </ul>
      <h3 className="workshop-section-title">稀有发现</h3>
      <ul className="collectible-list collectible-list--discoveries">
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
      </ul>
      <section className="workshop-upgrade" role="region" aria-label="星夜改装进度">
        <strong>星夜改装 {starryProgress} / 3</strong>
        <span>{starryProgress === 3 ? "星夜桌面已启用" : "完成星夜观测套装自动解锁星夜桌面"}</span>
        <progress max={3} value={starryProgress} aria-label="星夜改装进度" />
      </section>
    </section>
  );
}
