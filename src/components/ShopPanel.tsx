import { COLLECTIBLES } from "../domain/catalog";
import type { GameState } from "../domain/types";
import { isCollectibleLockedByActiveSpin } from "../inventory/inventory";
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
  return (
    <section className="utility-panel shop-panel" role="dialog" aria-label="收藏品商店">
      <PanelHeader title="收藏品商店" closeLabel="关闭商店" onClose={onClose} />
      <p className="panel-wallet">可用硬币：{state.wallet} 枚</p>
      <ul className="collectible-list">
        {COLLECTIBLES.map((item) => {
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
    </section>
  );
}
