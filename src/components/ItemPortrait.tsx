import type { CSSProperties } from "react";
import { ECOSYSTEM_ITEM_BY_ID } from "../ecosystem/catalog";
import type { EcosystemAssetUrls } from "./EcosystemScene";

type ResidentAssetKey = "fishGold" | "fishPearl" | "fishStripe" | "cropCarrot" | "cropTomato"
  | "cropCabbage" | "cropLeafy" | "cropPumpkin" | "cropOnion" | "animalChick" | "animalRabbit" | "animalAlpaca";
type PortraitFrame = { asset: ResidentAssetKey; atlas: "fish" | "crop" | "animal"; columns: number; rows: number; row: number };

// These cells deliberately match the native scene's lifecycle sheets, not a second icon set.
const PORTRAITS: Readonly<Record<string, PortraitFrame>> = {
  goldfish: { asset: "fishGold", atlas: "fish", columns: 4, rows: 3, row: 0 },
  clownfish: { asset: "fishPearl", atlas: "fish", columns: 4, rows: 3, row: 1 },
  "moon-carp": { asset: "fishStripe", atlas: "fish", columns: 4, rows: 3, row: 2 },
  "carrot-seed": { asset: "cropCarrot", atlas: "crop", columns: 4, rows: 6, row: 0 },
  "tomato-seed": { asset: "cropTomato", atlas: "crop", columns: 4, rows: 6, row: 1 },
  "cabbage-seed": { asset: "cropCabbage", atlas: "crop", columns: 4, rows: 6, row: 2 },
  "leafy-seed": { asset: "cropLeafy", atlas: "crop", columns: 4, rows: 6, row: 3 },
  "star-pumpkin": { asset: "cropPumpkin", atlas: "crop", columns: 4, rows: 6, row: 4 },
  "onion-seed": { asset: "cropOnion", atlas: "crop", columns: 4, rows: 6, row: 5 },
  chick: { asset: "animalChick", atlas: "animal", columns: 3, rows: 3, row: 0 },
  rabbit: { asset: "animalRabbit", atlas: "animal", columns: 3, rows: 3, row: 1 },
  alpaca: { asset: "animalAlpaca", atlas: "animal", columns: 3, rows: 3, row: 2 },
};

export interface ItemPortraitProps {
  itemId: string;
  assetUrls?: Partial<EcosystemAssetUrls>;
  /** Omit for the mature reference. Explicit frames show an actual growth stage. */
  frame?: number;
  size?: number;
  label?: string;
  decorative?: boolean;
  className?: string;
}

export function ItemPortrait({
  itemId, assetUrls, frame, size = 48, label, decorative = true, className = "",
}: ItemPortraitProps) {
  const spec = Object.hasOwn(PORTRAITS, itemId) ? PORTRAITS[itemId] : undefined;
  if (spec === undefined) return null;
  const column = frame !== undefined && Number.isFinite(frame)
    ? Math.max(0, Math.min(spec.columns - 1, Math.floor(frame)))
    : spec.columns - 1;
  const src = assetUrls?.[spec.asset] ?? `/assets/ecosystem-${spec.atlas}-lifecycle-atlas-v2.svg`;
  const style: CSSProperties = {
    display: "block",
    width: size,
    height: size,
    flexShrink: 0,
    imageRendering: "pixelated",
    backgroundImage: `url(${JSON.stringify(src)})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${spec.columns * 100}% ${spec.rows * 100}%`,
    backgroundPosition: `${column / (spec.columns - 1) * 100}% ${spec.row / (spec.rows - 1) * 100}%`,
  };
  return <span
    className={`item-portrait ${className}`.trim()}
    data-item-portrait={itemId}
    data-sprite-cell={`${spec.row}:${column}`}
    style={style}
    role={decorative ? undefined : "img"}
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : label ?? ECOSYSTEM_ITEM_BY_ID[itemId]?.name}
  />;
}
