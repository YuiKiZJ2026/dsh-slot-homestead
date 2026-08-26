import type { CSSProperties } from "react";
import { COLLECTIBLES } from "../domain/catalog";
import type { CollectibleDefinition, GameState, Rarity } from "../domain/types";
import { ASSET_FRAMES } from "../game/renderer/assets";

export interface CollectionPanelProps {
  open: boolean;
  state: GameState;
  onClose(): void;
  onSetDisplayed(id: string, displayed: boolean): void;
  mutationsDisabled?: boolean;
  collectiblesUrl?: string;
}

const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: "普通",
  rare: "稀有",
  set: "套装",
};

const EFFECT_NAMES: Readonly<Record<CollectibleDefinition["effect"]["kind"], string>> = {
  "idle-animation": "待机动画",
  particle: "像素粒子",
  sound: "可选音效",
  theme: "主题外观",
};

const STARRY_IDS = new Set(["star-projector", "constellation-globe", "comet-badge"]);

export function CollectionPanel({
  open,
  state,
  onClose,
  onSetDisplayed,
  mutationsDisabled = false,
  collectiblesUrl,
}: CollectionPanelProps) {
  if (!open) return null;

  const owned = new Set(state.ownedCollectibles);
  const displayed = new Set(state.displayedCollectibles);
  const starryProgress = state.ownedCollectibles.filter((id) => STARRY_IDS.has(id)).length;

  return (
    <section className="utility-panel collection-panel" role="dialog" aria-label="收藏柜">
      <PanelHeader title="收藏柜" closeLabel="关闭收藏柜" onClose={onClose} />
      <p className="set-progress">星夜观测 {starryProgress} / 3</p>
      <ul className="collectible-list">
        {COLLECTIBLES.map((item) => {
          const isOwned = owned.has(item.id);
          const isDisplayed = displayed.has(item.id);
          return (
            <li className="collectible-row" key={item.id}>
              <CollectibleSprite item={item} owned={isOwned} imageUrl={collectiblesUrl} />
              <span className="collectible-row__copy">
                <strong>{item.name}</strong>
                <small>{RARITY_NAMES[item.rarity]} · {EFFECT_NAMES[item.effect.kind]}</small>
              </span>
              <button
                type="button"
                className="pixel-button pixel-button--compact"
                disabled={!isOwned || mutationsDisabled}
                aria-label={isOwned
                  ? `${isDisplayed ? "收起" : "展示"} ${item.name}`
                  : `未拥有 ${item.name}`}
                onClick={() => onSetDisplayed(item.id, !isDisplayed)}
              >
                {isOwned ? (isDisplayed ? "收起" : "展示") : "未拥有"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CollectibleSprite({
  item,
  owned,
  imageUrl = "/assets/collectibles.png",
}: {
  item: CollectibleDefinition;
  owned: boolean;
  imageUrl?: string;
}) {
  const frame = ASSET_FRAMES.collectibles[item.id];
  const style: CSSProperties = {
    backgroundImage: `url(${JSON.stringify(imageUrl)})`,
    backgroundPosition: `${-(frame?.x ?? 0) / 2}px ${-(frame?.y ?? 0) / 2}px`,
    backgroundSize: "192px 144px",
  };
  return (
    <span
      className={`collectible-sprite${owned ? "" : " is-locked"}`}
      style={style}
      role="img"
      aria-label={owned ? `收藏品：${item.name}` : `未拥有：${item.name}`}
    />
  );
}

export function PanelHeader({
  title,
  closeLabel,
  onClose,
}: {
  title: string;
  closeLabel: string;
  onClose(): void;
}) {
  return (
    <header className="utility-panel__header">
      <h2>{title}</h2>
      <button type="button" className="pixel-button panel-close" aria-label={closeLabel} onClick={onClose}>
        ×
      </button>
    </header>
  );
}
