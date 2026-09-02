import { CATALOG_BY_ID } from "../domain/catalog";
import { legacyPlacements, TABLE_POSITIONS } from "../domain/table-positions";
import type { GameState, Rarity, ResolvedSpin, TablePositionId } from "../domain/types";
import { CollectibleSprite } from "./CollectionPanel";
import { ECOSYSTEM_ITEM_BY_ID } from "../ecosystem/catalog";

const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: "普通发现",
  rare: "稀有发现",
  set: "星夜套装",
};
const STARRY_IDS = new Set(["star-projector", "constellation-globe", "comet-badge"]);

export function SpinResultCard({
  spin,
  state,
  onDismiss,
  onPlace,
  collectiblesUrl,
}: {
  spin: ResolvedSpin;
  state: GameState;
  onDismiss(): void;
  onPlace?(id: string, positionId: TablePositionId): void;
  collectiblesUrl?: string;
}) {
  const reward = spin.reward;
  const placements = state.tablePlacements.length > 0
    ? state.tablePlacements
    : legacyPlacements(state.displayedCollectibles);
  const freePosition = TABLE_POSITIONS.find((position) => (
    !placements.some((placement) => placement.positionId === position.id)
  ));

  if (reward.kind === "collectible") {
    const item = CATALOG_BY_ID[reward.collectibleId];
    if (item === undefined) return <GenericResultCard title="发现未知收藏" detail="奖励已存入收藏盒" onDismiss={onDismiss} />;
    if (reward.isDuplicate) {
      const totalCoins = reward.conversionCoins + reward.bonusCoins;
      return (
        <GenericResultCard
          title={`重复收藏：${item.name}`}
          detail={`已自动折算为 ${totalCoins} 枚硬币`}
          onDismiss={onDismiss}
        />
      );
    }

    const projectedOwned = new Set(state.ownedCollectibles);
    projectedOwned.add(item.id);
    const starryProgress = [...STARRY_IDS].filter((id) => projectedOwned.has(id)).length;
    return (
      <section className="spin-result-card" role="dialog" aria-label="开奖结果" aria-modal="false">
        <span className="spin-result-card__eyebrow">首次发现</span>
        <div className="spin-result-card__reward">
          <CollectibleSprite item={item} owned imageUrl={collectiblesUrl} />
          <div>
            <strong>{item.name}</strong>
            <small>{RARITY_NAMES[item.rarity]}</small>
          </div>
        </div>
        {item.rarity === "set" ? (
          <p>星夜观测 {starryProgress} / 3{starryProgress === 3 ? " · 星夜桌面已解锁" : ""}</p>
        ) : (
          <p>已安全存入收藏盒，可以马上摆上桌面。</p>
        )}
        <div className="spin-result-card__actions">
          {onPlace !== undefined && freePosition !== undefined ? (
            <button
              type="button"
              className="pixel-button spin-result-card__primary"
              aria-label={`把 ${item.name} 摆上桌面`}
              onClick={() => {
                onPlace(item.id, freePosition.id);
                onDismiss();
              }}
            >摆上桌面</button>
          ) : null}
          <button
            type="button"
            className="pixel-button"
            aria-label={`把 ${item.name} 收进收藏盒`}
            onClick={onDismiss}
          >收进收藏盒</button>
        </div>
      </section>
    );
  }

  if (reward.kind === "coins") {
    const reasons = {
      refund: "本次拉杆费用已返还",
      "five-coins": "三枚金币连线奖励",
      "pity-fallback": "保底奖励已折算",
      "robot-fallback": "机器人大奖已折算",
    } as const;
    return (
      <GenericResultCard
        title={`获得 ${reward.amount} 枚硬币`}
        detail={reasons[reward.reason]}
        onDismiss={onDismiss}
      />
    );
  }

  if (reward.kind === "ecosystem-item") {
    const item = ECOSYSTEM_ITEM_BY_ID[reward.itemId];
    if (reward.isDuplicate) {
      return (
        <GenericResultCard
          title={`重复${item?.kind === "resident" ? "居民" : "用品"}：${item?.name ?? "未知生态物品"}`}
          detail={`已按品质自动折算为 ${reward.conversionCoins} 枚硬币`}
          onDismiss={onDismiss}
        />
      );
    }
    const habitatNames = { aquarium: "鱼缸", garden: "种植园", animals: "牧场" } as const;
    return (
      <GenericResultCard
        title={`${item?.kind === "resident" ? "新居民" : "获得用品"}：${item?.name ?? "生态物品"}`}
        detail={item?.kind === "supply"
          ? "已放入养成用品仓库"
          : `已送到${item === undefined ? "养成场景" : habitatNames[item.habitat]}，可以在右侧场景里照料它。`}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <GenericResultCard
      title="这次没有掉落"
      detail={`保底进度 ${spin.pityAfter} / 10`}
      onDismiss={onDismiss}
    />
  );
}

function GenericResultCard({
  title,
  detail,
  onDismiss,
}: {
  title: string;
  detail: string;
  onDismiss(): void;
}) {
  return (
    <section className="spin-result-card" role="dialog" aria-label="开奖结果" aria-modal="false">
      <span className="spin-result-card__eyebrow">本次结果</span>
      <strong className="spin-result-card__title">{title}</strong>
      <p>{detail}</p>
      <div className="spin-result-card__actions">
        <button type="button" className="pixel-button spin-result-card__primary" onClick={onDismiss}>继续</button>
      </div>
    </section>
  );
}
