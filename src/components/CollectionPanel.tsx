import { type CSSProperties, type DragEvent as ReactDragEvent } from "react";
import { COLLECTIBLES } from "../domain/catalog";
import { legacyPlacements } from "../domain/table-positions";
import type { CollectibleDefinition, GameState, Rarity, TablePositionId } from "../domain/types";
import { ASSET_FRAMES } from "../game/renderer/assets";
import { beginCollectibleDrag, draggedCollectibleId, endCollectibleDrag } from "./collectible-drag";

export interface CollectionPanelProps {
  open: boolean;
  state: GameState;
  onClose(): void;
  onSetPlacement?(id: string, positionId: TablePositionId | null): void;
  onSetDisplayed?(id: string, displayed: boolean): void;
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
  onSetPlacement,
  onSetDisplayed,
  mutationsDisabled = false,
  collectiblesUrl,
}: CollectionPanelProps) {
  if (!open) return null;

  const owned = new Set(state.ownedCollectibles);
  const placements = state.tablePlacements.length > 0
    ? state.tablePlacements
    : legacyPlacements(state.displayedCollectibles);
  const placementByItem = new Map(placements.map((placement) => [placement.itemId, placement]));
  const starryProgress = state.ownedCollectibles.filter((id) => STARRY_IDS.has(id)).length;
  const setPlacement = (itemId: string, positionId: TablePositionId | null): void => {
    if (onSetPlacement !== undefined) {
      onSetPlacement(itemId, positionId);
    } else {
      onSetDisplayed?.(itemId, positionId !== null);
    }
  };
  const returnDraggedItem = (event: ReactDragEvent<HTMLElement>): void => {
    const itemId = draggedCollectibleId(event.dataTransfer);
    if (itemId === null || !placementByItem.has(itemId) || mutationsDisabled) return;
    event.preventDefault();
    setPlacement(itemId, null);
    endCollectibleDrag();
  };

  return (
    <section className="utility-panel collection-panel" role="dialog" aria-label="收藏盒">
      <PanelHeader title="收藏盒" closeLabel="关闭收藏盒" onClose={onClose} />
      <p className="set-progress">抽到的收藏品会先存放在这里 · 星夜观测 {starryProgress} / 3</p>
      <ul
        className="collectible-grid"
        role="grid"
        aria-label="收藏品仓库格子"
        onDragOver={(event) => {
          const itemId = draggedCollectibleId(event.dataTransfer);
          if (itemId !== null && placementByItem.has(itemId) && !mutationsDisabled) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={returnDraggedItem}
      >
        {COLLECTIBLES.map((item) => {
          const isOwned = owned.has(item.id);
          const placement = placementByItem.get(item.id);
          const isDisplayed = placement !== undefined;
          return (
            <li
              className={`collectible-cell${isDisplayed ? " is-displayed" : ""}${isOwned ? "" : " is-locked"}`}
              key={item.id}
              role="gridcell"
              aria-label={isOwned
                ? `${item.name}，${isDisplayed ? "桌面上" : "仓库中"}，可拖${isDisplayed ? "动" : "到桌面"}`
                : `${item.name}，未拥有`}
              draggable={isOwned && !mutationsDisabled}
              onDragStart={(event) => beginCollectibleDrag(event.dataTransfer, item.id)}
              onDragEnd={endCollectibleDrag}
            >
              <CollectibleSprite item={item} owned={isOwned} imageUrl={collectiblesUrl} />
              <span className="collectible-cell__copy">
                <strong>{item.name}</strong>
                <small>{isOwned ? (isDisplayed ? "桌面上 · 可拖动" : "拖到桌面") : "未拥有"}</small>
                <span className="visually-hidden">{RARITY_NAMES[item.rarity]} · {EFFECT_NAMES[item.effect.kind]}</span>
              </span>
              {isDisplayed ? (
                <button
                  type="button"
                  className="collectible-cell__return"
                  disabled={mutationsDisabled}
                  aria-label={`收回 ${item.name} 到收藏盒`}
                  onClick={() => setPlacement(item.id, null)}
                >
                  收回
                </button>
              ) : null}
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
