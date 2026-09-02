import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { GameState, HabitatId } from "../domain/types";
import { ECOSYSTEM_ITEM_BY_ID } from "../ecosystem/catalog";
import {
  getHabitatLifecycleView,
  getHabitatReadyProduce,
  type CollectedHabitatProduce,
} from "../ecosystem/lifecycle";
import {
  animalVisualStage,
  animalVisualStageLabel,
  cropVisualStage,
  cropVisualStageLabel,
  fishVisualStage,
  fishVisualStageLabel,
  type VisualStage,
} from "../ecosystem/visual-stage";
import type { DayPhase } from "../time/day-phase";
import { HABITAT_SAFE_RECT, habitatStageRect, habitatVisibleRect } from "../ui/workbench-layout";

const HABITATS = ["aquarium", "garden", "animals"] as const;
const INTERACTION_COPY: Readonly<Record<string, string>> = {
  goldfish: "金鱼追着手指游了过来",
  clownfish: "小丑鱼绕着气泡转了一圈",
  "moon-carp": "月光锦鲤甩尾回应了你",
  "carrot-seed": "胡萝卜幼苗轻轻晃了晃叶子",
  "tomato-seed": "番茄苗朝着你抖了抖叶片",
  "cabbage-seed": "卷心菜叶片舒展开来",
  "leafy-seed": "青菜叶子沾着露水摇了摇",
  "star-pumpkin": "星光南瓜亮起了柔和的光",
  "onion-seed": "洋葱苗从土里探了探头",
  chick: "小鸡开心地跑来啄了啄",
  rabbit: "垂耳兔跳近闻了闻你的手",
  alpaca: "羊驼慢慢靠近蹭了蹭你",
};
const CARE_COPY: Readonly<Record<HabitatId, string>> = {
  aquarium: "鱼群发现鱼食，游向了投喂点",
  garden: "肥料渗进土壤，作物开始舒展",
  animals: "动物闻到饲料，向食槽聚拢",
};
export interface EcosystemAssetUrls {
  table: string;
  equipment: string;
  aquarium: string;
  garden: string;
  gardenWateringCan: string;
  animals: string;
  arrow: string;
  fishGold: string;
  fishPearl: string;
  fishStripe: string;
  waterPlant: string;
  bubbles: string;
  cropCarrot: string;
  cropTomato: string;
  cropCabbage: string;
  cropOnion: string;
  cropPumpkin: string;
  cropLeafy: string;
  animalChick: string;
  animalRabbit: string;
  animalAlpaca: string;
  animalProduce: string;
  reactionFish: string;
  reactionCrop: string;
  reactionAnimal: string;
  nightAquariumLamp: string;
  nightGardenLamp: string;
  scarecrow: string;
  nightPastureLamp: string;
}

export const DEFAULT_ECOSYSTEM_ASSET_URLS: EcosystemAssetUrls = {
  table: "/assets/ecosystem-workbench-table-v3.png?v=20260830-single-desk",
  equipment: "/assets/ecosystem-slot-equipment-v3.png?v=20260830-single-desk",
  aquarium: "/assets/ecosystem-reference-aquarium.png",
  garden: "/assets/ecosystem-garden-bed-v3.png",
  gardenWateringCan: "/assets/ecosystem-garden-watering-can-v3.png",
  animals: "/assets/ecosystem-reference-pasture.png",
  arrow: "/assets/ecosystem-arrow.png",
  fishGold: "/assets/ecosystem-fish-lifecycle-atlas-v2.svg",
  fishPearl: "/assets/ecosystem-fish-lifecycle-atlas-v2.svg",
  fishStripe: "/assets/ecosystem-fish-lifecycle-atlas-v2.svg",
  waterPlant: "/assets/ecosystem-water-plant.png",
  bubbles: "/assets/ecosystem-bubbles.png",
  cropCarrot: "/assets/ecosystem-crop-lifecycle-atlas-v2.svg",
  cropTomato: "/assets/ecosystem-crop-lifecycle-atlas-v2.svg",
  cropCabbage: "/assets/ecosystem-crop-lifecycle-atlas-v2.svg",
  cropOnion: "/assets/ecosystem-crop-lifecycle-atlas-v2.svg",
  cropPumpkin: "/assets/ecosystem-crop-lifecycle-atlas-v2.svg",
  cropLeafy: "/assets/ecosystem-crop-lifecycle-atlas-v2.svg",
  animalChick: "/assets/ecosystem-animal-lifecycle-atlas-v2.svg",
  animalRabbit: "/assets/ecosystem-animal-lifecycle-atlas-v2.svg",
  animalAlpaca: "/assets/ecosystem-animal-lifecycle-atlas-v2.svg",
  animalProduce: "/assets/ecosystem-animal-produce-atlas-v2.svg",
  reactionFish: "/assets/ecosystem-reaction-fish.png",
  reactionCrop: "/assets/ecosystem-reaction-crop.png",
  reactionAnimal: "/assets/ecosystem-reaction-animal.png",
  nightAquariumLamp: "/assets/ecosystem-night-aquarium-lamp.png",
  nightGardenLamp: "/assets/ecosystem-night-garden-lamp.png",
  scarecrow: "/assets/ecosystem-scarecrow.png",
  nightPastureLamp: "/assets/ecosystem-night-pasture-lamp.png",
};

type MotionKind = "swim" | "sway" | "rise" | "grow" | "peck" | "hop" | "walk";
type ReactionKind = "fish" | "crop" | "animal";
type MotionAssetKey = Exclude<keyof EcosystemAssetUrls,
  "table" | "equipment" | "aquarium" | "garden" | "gardenWateringCan" | "animals" | "arrow"
  | "reactionFish" | "reactionCrop" | "reactionAnimal"
  | "nightAquariumLamp" | "nightGardenLamp" | "scarecrow" | "nightPastureLamp"
  | "animalProduce"
>;
type ReactionAssetKey = "reactionFish" | "reactionCrop" | "reactionAnimal";
type ResidentReaction = {
  layerId: string;
  kind: ReactionKind;
  message: string;
  sequence: number;
};
type CareFeedback = {
  habitat: HabitatId;
  sequence: number;
};
type MotionLayer = {
  id: string;
  asset: MotionAssetKey;
  motion: MotionKind;
  residentId?: string;
  plot?: number;
  plotAnchor?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  behavior?: "wander-peck-drink-rest" | "hop-graze-hide-rest" | "roam-graze-drink-rest";
};

interface SpriteSheetSpec {
  columns: number;
  rows: number;
  row: number;
}

const RESIDENT_SPRITE_SHEETS: Readonly<Record<string, SpriteSheetSpec>> = {
  goldfish: { columns: 4, rows: 3, row: 0 },
  clownfish: { columns: 4, rows: 3, row: 1 },
  "moon-carp": { columns: 4, rows: 3, row: 2 },
  "carrot-seed": { columns: 4, rows: 6, row: 0 },
  "tomato-seed": { columns: 4, rows: 6, row: 1 },
  "cabbage-seed": { columns: 4, rows: 6, row: 2 },
  "leafy-seed": { columns: 4, rows: 6, row: 3 },
  "star-pumpkin": { columns: 4, rows: 6, row: 4 },
  "onion-seed": { columns: 4, rows: 6, row: 5 },
  chick: { columns: 3, rows: 3, row: 0 },
  rabbit: { columns: 3, rows: 3, row: 1 },
  alpaca: { columns: 3, rows: 3, row: 2 },
};

const GROUND_PRODUCE_FRAMES: Readonly<Record<string, number>> = {
  egg: 0,
};

const HABITAT_LAYERS: Record<HabitatId, MotionLayer[]> = {
  aquarium: [
    { id: "plant-left", asset: "waterPlant", motion: "sway" },
    { id: "plant-right", asset: "waterPlant", motion: "sway" },
    { id: "bubbles-slow", asset: "bubbles", motion: "rise" },
    { id: "bubbles-fast", asset: "bubbles", motion: "rise" },
    { id: "fish-gold", asset: "fishGold", motion: "swim", residentId: "goldfish" },
    { id: "fish-pearl", asset: "fishPearl", motion: "swim", residentId: "clownfish" },
    { id: "fish-stripe", asset: "fishStripe", motion: "swim", residentId: "moon-carp" },
  ],
  garden: [
    { id: "crop-carrot", asset: "cropCarrot", motion: "grow", residentId: "carrot-seed", plot: 1, plotAnchor: "top-left" },
    { id: "crop-tomato", asset: "cropTomato", motion: "grow", residentId: "tomato-seed", plot: 2, plotAnchor: "top-center" },
    { id: "crop-cabbage", asset: "cropCabbage", motion: "grow", residentId: "cabbage-seed", plot: 3, plotAnchor: "top-right" },
    { id: "crop-leafy", asset: "cropLeafy", motion: "grow", residentId: "leafy-seed", plot: 4, plotAnchor: "bottom-left" },
    { id: "crop-pumpkin", asset: "cropPumpkin", motion: "grow", residentId: "star-pumpkin", plot: 5, plotAnchor: "bottom-center" },
    { id: "crop-onion", asset: "cropOnion", motion: "grow", residentId: "onion-seed", plot: 6, plotAnchor: "bottom-right" },
  ],
  animals: [
    { id: "animal-chick", asset: "animalChick", motion: "peck", residentId: "chick", behavior: "wander-peck-drink-rest" },
    { id: "animal-rabbit", asset: "animalRabbit", motion: "hop", residentId: "rabbit", behavior: "hop-graze-hide-rest" },
    { id: "animal-alpaca", asset: "animalAlpaca", motion: "walk", residentId: "alpaca", behavior: "roam-graze-drink-rest" },
  ],
};

const HABITAT_COPY: Record<HabitatId, {
  title: string;
  imageAlt: string;
  action: string;
  supply: string;
  supplyKey: "fishFeed" | "fertilizer" | "animalFeed";
}> = {
  aquarium: {
    title: "鱼缸",
    imageAlt: "像素鱼缸，里面生活着会游动的鱼和摇摆的水草",
    action: "投喂",
    supply: "鱼食",
    supplyKey: "fishFeed",
  },
  garden: {
    title: "种植园",
    imageAlt: "像素种植园，所有作物都在生长和摇摆",
    action: "施肥",
    supply: "肥料",
    supplyKey: "fertilizer",
  },
  animals: {
    title: "牧场",
    imageAlt: "像素牧场，动物会走动、跳跃和啄食",
    action: "喂食",
    supply: "动物饲料",
    supplyKey: "animalFeed",
  },
};

const REACTION_KIND_BY_HABITAT: Readonly<Record<HabitatId, ReactionKind>> = {
  aquarium: "fish",
  garden: "crop",
  animals: "animal",
};
const REACTION_ASSET_BY_KIND: Readonly<Record<ReactionKind, ReactionAssetKey>> = {
  fish: "reactionFish",
  crop: "reactionCrop",
  animal: "reactionAnimal",
};

function SpriteFrame({
  src,
  sheetId,
  spec,
  frame,
  className = "ecosystem-resident-sprite",
}: {
  src: string;
  sheetId: string;
  spec: SpriteSheetSpec;
  frame: number;
  className?: string;
}) {
  return <span
    className={className}
    data-sprite-sheet={sheetId}
    data-sprite-cell={`${spec.row}:${frame}`}
    style={spriteFrameStyle(src, spec, frame)}
    aria-hidden="true"
  />;
}

function PastureGroundProduce({
  produce,
  assetUrl,
  disabled,
  onCollect,
}: {
  produce: readonly CollectedHabitatProduce[];
  assetUrl: string;
  disabled: boolean;
  onCollect(): void;
}) {
  if (produce.length === 0) return null;

  return <div className="ecosystem-scene__ground-produce-layer" aria-label="牧场地面产物">
    {produce.map((item) => {
      const frame = GROUND_PRODUCE_FRAMES[item.id];
      if (frame === undefined) return null;
      return <button
        key={item.id}
        type="button"
        className={`ecosystem-scene__ground-produce ecosystem-scene__ground-produce--${item.id}`}
        aria-label={`拾取${item.name} ${item.count}`}
        title={`拾取${item.name} ×${item.count}`}
        data-ground-produce={item.id}
        data-ground-produce-count={item.count}
        disabled={disabled}
        onClick={onCollect}
      >
        <SpriteFrame
          src={assetUrl}
          sheetId="animal-produce"
          spec={{ columns: 3, rows: 1, row: 0 }}
          frame={frame}
          className="ecosystem-scene__ground-produce-sprite"
        />
        {item.count > 1 ? <span className="ecosystem-scene__ground-produce-count">×{item.count}</span> : null}
      </button>;
    })}
  </div>;
}

function StaticWorkbench({
  tableSrc,
  equipmentSrc,
}: {
  tableSrc: string;
  equipmentSrc: string;
}) {
  return <>
    <img
      className="ecosystem-scene__table-base"
      src={tableSrc}
      alt=""
      aria-hidden="true"
    />
    <img
      className="ecosystem-scene__equipment-base"
      src={equipmentSrc}
      alt=""
      aria-hidden="true"
    />
  </>;
}

function HabitatAtmosphere({
  habitat,
  assetUrls,
  transitionDirection,
}: {
  habitat: HabitatId;
  assetUrls: EcosystemAssetUrls;
  transitionDirection: "previous" | "next";
}) {
  return (
    <div
      key={`atmosphere-${habitat}`}
      className="ecosystem-scene__atmosphere-layer"
      data-night-habitat={habitat}
      data-transition-direction={transitionDirection}
      aria-hidden="true"
    >
      <svg className="ecosystem-scene__alpha-filter" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="dsh-night-prop-alpha-cutout" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0 0 0 1" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      {habitat === "aquarium" ? <>
        <span
          className="ecosystem-scene__night-glow ecosystem-scene__night-glow--aquarium"
          data-night-glow="aquarium"
          data-light-cast="tank-wash"
          data-light-motion="steady"
          aria-hidden="true"
        />
        <span
          className="ecosystem-scene__night-hotspot ecosystem-scene__night-hotspot--aquarium"
          data-night-hotspot="aquarium"
          data-light-role="wick"
          data-light-motion="flicker"
          aria-hidden="true"
        />
        <img
          className="ecosystem-scene__atmosphere-prop ecosystem-scene__atmosphere-prop--aquarium-lamp"
          src={assetUrls.nightAquariumLamp}
          alt=""
          data-habitat-prop="aquarium-lamp"
          aria-hidden="true"
        />
      </> : null}

      {habitat === "garden" ? <>
        <span
          className="ecosystem-scene__night-glow ecosystem-scene__night-glow--garden"
          data-night-glow="garden"
          data-light-cast="garden-pool"
          data-light-motion="steady"
          aria-hidden="true"
        />
        <span
          className="ecosystem-scene__night-hotspot ecosystem-scene__night-hotspot--garden"
          data-night-hotspot="garden"
          data-light-role="wick"
          data-light-motion="flicker"
          aria-hidden="true"
        />
        <img
          className="ecosystem-scene__atmosphere-prop ecosystem-scene__atmosphere-prop--garden-lamp"
          src={assetUrls.nightGardenLamp}
          alt=""
          data-habitat-prop="garden-lamp"
          aria-hidden="true"
        />
        <img
          className="ecosystem-scene__atmosphere-prop ecosystem-scene__atmosphere-prop--scarecrow"
          src={assetUrls.scarecrow}
          alt=""
          data-habitat-prop="scarecrow"
          aria-hidden="true"
        />
      </> : null}

      {habitat === "animals" ? <>
        <span
          className="ecosystem-scene__night-glow ecosystem-scene__night-glow--animals"
          data-night-glow="animals"
          data-light-cast="left"
          data-light-motion="steady"
          aria-hidden="true"
        />
        <span
          className="ecosystem-scene__night-hotspot ecosystem-scene__night-hotspot--animals"
          data-night-hotspot="animals"
          data-light-role="wick"
          data-light-motion="flicker"
          aria-hidden="true"
        />
        <img
          className="ecosystem-scene__atmosphere-prop ecosystem-scene__atmosphere-prop--pasture-lamp"
          src={assetUrls.nightPastureLamp}
          alt=""
          data-habitat-prop="pasture-lamp"
          data-lamp-facing="left"
          aria-hidden="true"
        />
      </> : null}
    </div>
  );
}

export function EcosystemScene({
  state,
  dayPhase = "day",
  onCare,
  onCollect,
  mutationsDisabled = false,
  assetUrls = DEFAULT_ECOSYSTEM_ASSET_URLS,
  nightSky,
  commandBar,
}: {
  state: GameState;
  dayPhase?: DayPhase;
  onCare(habitat: HabitatId): void;
  onCollect?(habitat: Extract<HabitatId, "garden" | "animals">): void;
  mutationsDisabled?: boolean;
  assetUrls?: EcosystemAssetUrls;
  nightSky?: ReactNode;
  commandBar?: ReactNode;
}) {
  const [habitatIndex, setHabitatIndex] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<"previous" | "next">("next");
  const [habitatDrawerOpen, setHabitatDrawerOpen] = useState(false);
  const [residentReaction, setResidentReaction] = useState<ResidentReaction | null>(null);
  const [careFeedback, setCareFeedback] = useState<CareFeedback | null>(null);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionSequence = useRef(0);
  const careSequence = useRef(0);
  const habitat = HABITATS[habitatIndex]!;
  const animalsResting = habitat === "animals" && dayPhase === "night";
  const copy = HABITAT_COPY[habitat];
  const selected = ECOSYSTEM_ITEM_BY_ID[state.ecosystem.selected[habitat]];
  const supplyCount = state.ecosystem.supplies[copy.supplyKey];
  const lifecycleView = getHabitatLifecycleView(state.ecosystem, habitat);
  const readyProduce = habitat === "aquarium"
    ? []
    : getHabitatReadyProduce(state.ecosystem, habitat);
  const readyProduceCount = readyProduce.reduce((sum, item) => sum + item.count, 0);
  const lifecycleProgress = Math.round(lifecycleView.progress);
  const lifecycleStageLabel = stageLabel(
    habitat,
    lifecycleView.progress,
    lifecycleView.adults,
    lifecycleView.readyCount,
  );
  const careUseful = habitat === "aquarium"
    ? lifecycleView.progress < 100
    : habitat === "garden"
      ? lifecycleView.progress < 100 && lifecycleView.readyCount === 0
      : lifecycleView.readyCount < 9;
  const lifecycleOutput = readyProduceCount > 0
    ? `产出：${readyProduce.map((item) => `${item.name} ×${item.count}`).join("、")}`
    : "产出：暂无";
  const discovered = new Set(state.ecosystem.discovered);
  const visibleLayers = HABITAT_LAYERS[habitat].filter(
    (layer) => !animalsResting && (layer.residentId === undefined || discovered.has(layer.residentId)),
  );
  const stageRect = habitatStageRect(habitat);
  const visibleRect = habitatVisibleRect(habitat);
  const safeRect = `${HABITAT_SAFE_RECT.left},${HABITAT_SAFE_RECT.top},${HABITAT_SAFE_RECT.right},${HABITAT_SAFE_RECT.bottom}`;
  const stageStyle = {
    left: `${stageRect.x - HABITAT_SAFE_RECT.left}px`,
    top: `${stageRect.y - HABITAT_SAFE_RECT.top}px`,
    width: `${stageRect.width}px`,
    height: `${stageRect.height}px`,
  } as CSSProperties;
  useEffect(() => () => {
    if (reactionTimer.current !== null) clearTimeout(reactionTimer.current);
  }, []);

  const reactToResident = (layer: MotionLayer): void => {
    if (layer.residentId === undefined) return;
    if (reactionTimer.current !== null) clearTimeout(reactionTimer.current);
    reactionSequence.current += 1;
    setResidentReaction({
      layerId: layer.id,
      kind: REACTION_KIND_BY_HABITAT[habitat],
      message: INTERACTION_COPY[layer.residentId] ?? "它注意到了你",
      sequence: reactionSequence.current,
    });
    reactionTimer.current = setTimeout(() => {
      setResidentReaction(null);
      reactionTimer.current = null;
    }, 1700);
  };
  const changeHabitat = (offset: number): void => {
    if (reactionTimer.current !== null) {
      clearTimeout(reactionTimer.current);
      reactionTimer.current = null;
    }
    setInteractionNotice(null);
    setResidentReaction(null);
    setCareFeedback(null);
    setHabitatDrawerOpen(false);
    setTransitionDirection(offset < 0 ? "previous" : "next");
    setHabitatIndex((current) => (current + offset + HABITATS.length) % HABITATS.length);
  };

  return (
    <section className={`ecosystem-scene ecosystem-scene--${habitat}`} role="region" aria-label="养成生态">
      {nightSky}
      <div
        className="ecosystem-scene__art"
        data-table-layout="single-workbench-704x304"
        data-table-seam="none-single-surface"
      >
        <StaticWorkbench tableSrc={assetUrls.table} equipmentSrc={assetUrls.equipment} />
        <div
          className="ecosystem-scene__habitat-bay"
          data-safe-rect={safeRect}
        >
          <div
            key={habitat}
            className="ecosystem-scene__habitat-stage"
            data-habitat={habitat}
            data-routine-state={habitat === "animals" ? (animalsResting ? "resting" : "active") : undefined}
            data-transition-direction={transitionDirection}
            data-habitat-dock="fixed-ecosystem-bay"
            data-coordinate-space="workbench-704x304"
            data-visible-rect={`${visibleRect.left.toFixed(1)},${visibleRect.top.toFixed(1)},${visibleRect.right.toFixed(1)},${visibleRect.bottom.toFixed(1)}`}
            style={stageStyle}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button") !== null) return;
              setHabitatDrawerOpen((open) => !open);
            }}
          >
            <img
              className="ecosystem-scene__habitat-layer"
              src={assetUrls[habitat]}
              alt={animalsResting ? "像素牧场，动物已经回舍休息" : copy.imageAlt}
              data-habitat={habitat}
            />
            {habitat === "garden" ? <img
              className="ecosystem-scene__habitat-prop"
              src={assetUrls.gardenWateringCan}
              alt=""
              aria-hidden="true"
              data-habitat-prop="watering-can"
            /> : null}
            {visibleLayers.map((layer) => {
              const isReacting = residentReaction?.layerId === layer.id;
              const growthStage = growthStageForLayer(state, habitat, layer);
              const growthProgress = growthProgressForLayer(state, habitat, layer);
              const residentVisual = visualStageForLayer(state, habitat, layer);
              const spriteSheet = layer.residentId === undefined
                ? undefined
                : RESIDENT_SPRITE_SHEETS[layer.residentId];
              const livestock = habitat === "animals" && layer.residentId !== undefined
                ? state.ecosystem.lifecycle.livestock[layer.residentId]
                : undefined;
              const companionVisual = (livestock?.adults ?? 0) > 0 && (livestock?.juveniles ?? 0) > 0
                ? animalVisualStage({ adults: 0, juvenileGrowth: livestock?.juvenileGrowth ?? 0 })
                : null;

            if (layer.plot !== undefined && layer.residentId !== undefined) {
              const residentName = ECOSYSTEM_ITEM_BY_ID[layer.residentId]?.name ?? "居民";
              return <button
                key={layer.id}
                type="button"
                className={`ecosystem-plot-cell ecosystem-plot-cell--${layer.plot}${isReacting ? " is-selected is-reacting" : ""}`}
                aria-label={`与${residentName}互动`}
                data-plot-cell={layer.plot}
                data-plot-anchor={layer.plotAnchor}
                data-plot-alignment="visual-center"
                onClick={() => reactToResident(layer)}
              >
                <span
                  className={`ecosystem-motion-layer ecosystem-motion-layer--${layer.id}`}
                  data-motion={layer.motion}
                  data-resident-id={layer.residentId}
                   data-plot={layer.plot}
                   data-growth-stage={growthStage}
                   data-growth-progress={growthProgress}
                   data-visual-stage={residentVisual.stage}
                   data-sprite-frame={residentVisual.frame}
                 >
                  <span
                    key={isReacting ? (residentReaction?.sequence ?? 0) : 0}
                    className="ecosystem-resident-feedback-frame"
                  >
                    <SpriteFrame
                      key={`${layer.id}-${residentVisual.frame}`}
                      src={assetUrls[layer.asset]}
                      sheetId={layer.id}
                      spec={spriteSheet ?? { columns: 1, rows: 1, row: 0 }}
                      frame={residentVisual.frame}
                    />
                  </span>
                </span>
              </button>;
            }

            if (layer.residentId !== undefined) {
              const residentName = ECOSYSTEM_ITEM_BY_ID[layer.residentId]?.name ?? "居民";
              return <button
                key={layer.id}
                type="button"
                className={`ecosystem-resident-interaction ecosystem-motion-layer ecosystem-motion-layer--${layer.id}${isReacting ? " is-reacting" : ""}`}
                aria-label={`与${residentName}互动`}
                data-motion={layer.motion}
                data-resident-id={layer.residentId}
                 data-behavior={layer.behavior}
                 data-growth-stage={growthStage}
                 data-growth-progress={growthProgress}
                 data-visual-stage={residentVisual.stage}
                 data-sprite-frame={residentVisual.frame}
                 data-routine-state="active"
                 onClick={() => reactToResident(layer)}
              >
                <span
                  key={isReacting ? (residentReaction?.sequence ?? 0) : 0}
                  className="ecosystem-resident-feedback-frame"
                >
                  <SpriteFrame
                    key={`${layer.id}-${residentVisual.frame}`}
                    src={assetUrls[layer.asset]}
                    sheetId={layer.id}
                    spec={spriteSheet ?? { columns: 1, rows: 1, row: 0 }}
                    frame={residentVisual.frame}
                  />
                </span>
                {companionVisual === null || spriteSheet === undefined ? null : <span
                  className="ecosystem-animal-companion"
                  data-animal-companion="juvenile"
                  data-resident-id={layer.residentId}
                  data-visual-stage={companionVisual.stage}
                  data-sprite-frame={companionVisual.frame}
                  aria-hidden="true"
                >
                  <SpriteFrame
                    key={`${layer.id}-companion-${companionVisual.frame}`}
                    src={assetUrls[layer.asset]}
                    sheetId={`${layer.id}-companion`}
                    spec={spriteSheet}
                    frame={companionVisual.frame}
                  />
                </span>}
              </button>;
            }

            return <img
              key={layer.id}
              className={`ecosystem-motion-layer ecosystem-motion-layer--${layer.id}`}
              src={assetUrls[layer.asset]}
              alt=""
              aria-hidden="true"
              data-motion={layer.motion}
            />;
            })}
            {habitat === "animals" ? <PastureGroundProduce
              produce={readyProduce}
              assetUrl={assetUrls.animalProduce}
              disabled={mutationsDisabled || onCollect === undefined}
              onCollect={() => {
                setInteractionNotice(
                  `${readyProduce.map((item) => item.name).join("、")}已经从牧场地面收入仓库`,
                );
                onCollect?.("animals");
              }}
            /> : null}
            {animalsResting ? (
              <div
                className="ecosystem-scene__animal-rest"
                data-night-rest="animals"
                data-rest-kind="sleeping-animals"
                data-routine-state="resting"
                aria-hidden="true"
              >
                <span className="ecosystem-scene__coop-warmth" aria-hidden="true" />
                <span className="ecosystem-scene__sleep-mark ecosystem-scene__sleep-mark--near" aria-hidden="true">z</span>
                <span className="ecosystem-scene__sleep-mark ecosystem-scene__sleep-mark--far" aria-hidden="true">z</span>
              </div>
            ) : null}
            {careFeedback?.habitat === habitat && <div
              key={careFeedback.sequence}
              className="ecosystem-scene__care-feedback"
              aria-hidden="true"
              data-care-sequence={careFeedback.sequence}
              data-care-habitat={careFeedback.habitat}
            />}
            {residentReaction !== null && <div
              key={residentReaction.sequence}
              className={`ecosystem-scene__reaction ecosystem-scene__reaction--${residentReaction.kind}`}
              role="status"
              aria-live="polite"
              data-reaction-kind={residentReaction.kind}
              data-reaction-sequence={residentReaction.sequence}
            >
              <img
                className="ecosystem-scene__reaction-effect"
                src={assetUrls[REACTION_ASSET_BY_KIND[residentReaction.kind]]}
                alt=""
                aria-hidden="true"
              />
              <span>{residentReaction.message}</span>
            </div>}
          </div>
        </div>
      </div>
      <HabitatAtmosphere
        habitat={habitat}
        assetUrls={assetUrls}
        transitionDirection={transitionDirection}
      />
      {!habitatDrawerOpen ? <button
        type="button"
        className="ecosystem-scene__habitat-drawer-handle"
        aria-label={`打开${copy.title}养成抽屉`}
        onClick={() => setHabitatDrawerOpen(true)}
      >养成</button> : null}
      <div className="ecosystem-scene__command-deck" data-layout="contextual-one-row">
        {commandBar}
        <div className="ecosystem-scene__switcher">
          <button
            type="button"
            className="habitat-arrow habitat-arrow--previous"
            aria-label="上一处养成场景"
            onClick={() => changeHabitat(-1)}
          >
            <img src={assetUrls.arrow} alt="" aria-hidden="true" />
          </button>
          <strong aria-live="polite" aria-atomic="true">
            {copy.title} {habitatIndex + 1} / 3 · {lifecycleStageLabel} {lifecycleProgress}%
          </strong>
          <button
            type="button"
            className="habitat-arrow habitat-arrow--next"
            aria-label="下一处养成场景"
            onClick={() => changeHabitat(1)}
          >
            <img src={assetUrls.arrow} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
      {habitatDrawerOpen ? <aside
        className="ecosystem-scene__habitat-drawer"
        role="region"
        aria-label={`${copy.title}养成抽屉`}
      >
        <button
          type="button"
          className="ecosystem-scene__habitat-drawer-close"
          aria-label={`收起${copy.title}养成抽屉`}
          onClick={() => setHabitatDrawerOpen(false)}
        >×</button>
        <div className="ecosystem-scene__status">
          <span className="ecosystem-scene__resident">{selected?.name ?? "等待新居民"}</span>
          <span>{copy.supply} {supplyCount}</span>
          <progress max={100} value={lifecycleProgress} aria-label={`${copy.title}成长进度`} />
          <small>
            阶段：{lifecycleStageLabel} · 成长 {lifecycleProgress}%
            {habitat === "animals" && lifecycleView.adults > 0
              ? ` · ${adultAnimalLabel(lifecycleView.id)} ${lifecycleView.adults}只`
              : ""}
          </small>
          <small className="ecosystem-scene__produce" data-ready-count={readyProduceCount}>
            {lifecycleOutput}
            {readyProduceCount > 0
              ? ` · ${readyProduce.map((item) => `${item.name}${habitat === "garden" ? "可收获" : "待领取"} ${item.count}`).join("、")}`
              : lifecycleView.productName !== null && lifecycleView.inventoryCount > 0
                ? ` · 仓库 ${lifecycleView.inventoryCount}`
                : ""}
          </small>
        </div>
        <div className="ecosystem-scene__actions">
          <button
            type="button"
            className="pixel-button ecosystem-scene__care"
            aria-label={`${copy.action}${copy.title}`}
            disabled={mutationsDisabled || supplyCount <= 0 || !careUseful}
            onClick={() => {
              careSequence.current += 1;
              setCareFeedback({ habitat, sequence: careSequence.current });
              setInteractionNotice(CARE_COPY[habitat]);
              onCare(habitat);
            }}
          >{copy.action}</button>
          {habitat !== "aquarium" ? <button
            type="button"
            className="pixel-button ecosystem-scene__collect"
            aria-label="收获"
            title={`收获${copy.title}产出`}
            disabled={mutationsDisabled || readyProduceCount <= 0}
            onClick={() => {
              setInteractionNotice(
                readyProduceCount > 0
                  ? `${readyProduce.map((item) => item.name).join("、")}已经收入仓库`
                  : "还没有可收获的产出",
              );
              onCollect?.(habitat);
            }}
          >收获</button> : null}
          <span className="ecosystem-scene__interaction-notice" aria-live="polite">
            {supplyCount <= 0
              ? `${copy.supply}用完了，仍会自然成长；补给后可加速`
              : !careUseful
                ? habitat === "aquarium"
                  ? "已经长成成鱼，现在不需要继续投喂加速"
                  : habitat === "garden"
                    ? "作物已经成熟，先收获再继续施肥"
                    : "产出栏已满，先收获再继续喂食"
              : interactionNotice ?? (animalsResting ? "夜深了，动物都回舍休息" : "点击居民互动")}
          </span>
        </div>
        <div className="ecosystem-harmony" aria-label="生态心愿进度">
          <span>生态心愿 {state.ecosystem.harmony}%</span>
          <progress max={100} value={state.ecosystem.harmony} />
        </div>
      </aside> : null}
    </section>
  );
}

function growthStageForLayer(
  state: GameState,
  habitat: HabitatId,
  layer: MotionLayer,
): "growing" | "ready" | "adult" {
  if (layer.residentId === undefined) return "adult";
  if (habitat === "aquarium") {
    return (state.ecosystem.lifecycle.fish[layer.residentId]?.growth ?? 0) >= 100
      ? "adult"
      : "growing";
  }
  if (habitat === "garden" && layer.plot !== undefined) {
    const plot = state.ecosystem.lifecycle.plots[String(layer.plot) as keyof typeof state.ecosystem.lifecycle.plots];
    return (plot?.readyYield ?? 0) > 0 ? "ready" : "growing";
  }
  const livestock = state.ecosystem.lifecycle.livestock[layer.residentId];
  return (livestock?.adults ?? 0) > 0 ? "adult" : "growing";
}

function growthProgressForLayer(
  state: GameState,
  habitat: HabitatId,
  layer: MotionLayer,
): number {
  if (layer.residentId === undefined) return 100;
  if (habitat === "aquarium") {
    return Math.round(state.ecosystem.lifecycle.fish[layer.residentId]?.growth ?? 0);
  }
  if (habitat === "garden" && layer.plot !== undefined) {
    const plot = state.ecosystem.lifecycle.plots[String(layer.plot) as keyof typeof state.ecosystem.lifecycle.plots];
    return Math.round(plot?.growth ?? 0);
  }
  const livestock = state.ecosystem.lifecycle.livestock[layer.residentId];
  return Math.round((livestock?.adults ?? 0) > 0 ? 100 : (livestock?.juvenileGrowth ?? 0));
}

function visualStageForLayer(
  state: GameState,
  habitat: HabitatId,
  layer: MotionLayer,
): VisualStage<string> {
  if (layer.residentId === undefined) return { stage: "adult", frame: 0 };
  if (habitat === "aquarium") {
    return fishVisualStage(state.ecosystem.lifecycle.fish[layer.residentId]?.growth ?? 0);
  }
  if (habitat === "garden" && layer.plot !== undefined) {
    const plot = state.ecosystem.lifecycle.plots[String(layer.plot) as keyof typeof state.ecosystem.lifecycle.plots];
    return cropVisualStage(plot?.growth ?? 0, plot?.readyYield ?? 0);
  }
  return animalVisualStage(state.ecosystem.lifecycle.livestock[layer.residentId]);
}

function spriteFrameStyle(
  src: string,
  spec: SpriteSheetSpec,
  frame: number,
): CSSProperties {
  const column = Math.min(spec.columns - 1, Math.max(0, frame));
  const x = spec.columns <= 1 ? 0 : column / (spec.columns - 1) * 100;
  const y = spec.rows <= 1 ? 0 : spec.row / (spec.rows - 1) * 100;
  return {
    aspectRatio: "1 / 1",
    backgroundImage: `url("${src}")`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${spec.columns * 100}% ${spec.rows * 100}%`,
  };
}

function stageLabel(
  habitat: HabitatId,
  progress: number,
  adults: number,
  readyCount: number,
): string {
  if (habitat === "aquarium") return fishVisualStageLabel(progress);
  if (habitat === "garden") return cropVisualStageLabel(progress, readyCount);
  return animalVisualStageLabel({ adults, juvenileGrowth: progress });
}

function adultAnimalLabel(id: string): string {
  if (id === "chick") return "成鸡";
  if (id === "rabbit") return "成年兔";
  if (id === "alpaca") return "成年羊驼";
  return "成体";
}
