import type { EcosystemLivestockLife } from "../domain/types";

export type FishVisualStage = "fry" | "juvenile" | "young" | "adult";
export type CropVisualStage = "seedling" | "leafing" | "fruiting" | "harvest-ready";
export type AnimalVisualStage = "baby" | "young" | "adult";

export interface VisualStage<TStage extends string> {
  stage: TStage;
  frame: number;
}

export function fishVisualStage(progress: number): VisualStage<FishVisualStage> {
  if (progress >= 100) return { stage: "adult", frame: 3 };
  if (progress >= 55) return { stage: "young", frame: 2 };
  if (progress >= 20) return { stage: "juvenile", frame: 1 };
  return { stage: "fry", frame: 0 };
}

export function cropVisualStage(
  progress: number,
  readyYield: number,
): VisualStage<CropVisualStage> {
  if (readyYield > 0 || progress >= 100) return { stage: "harvest-ready", frame: 3 };
  if (progress >= 55) return { stage: "fruiting", frame: 2 };
  if (progress >= 20) return { stage: "leafing", frame: 1 };
  return { stage: "seedling", frame: 0 };
}

export function animalVisualStage(
  life: Pick<EcosystemLivestockLife, "adults" | "juvenileGrowth"> | undefined,
): VisualStage<AnimalVisualStage> {
  if ((life?.adults ?? 0) > 0) return { stage: "adult", frame: 2 };
  if ((life?.juvenileGrowth ?? 0) >= 18) return { stage: "young", frame: 1 };
  return { stage: "baby", frame: 0 };
}

export function fishVisualStageLabel(progress: number): string {
  const labels: Readonly<Record<FishVisualStage, string>> = {
    fry: "鱼苗",
    juvenile: "幼鱼",
    young: "青年鱼",
    adult: "成鱼",
  };
  return labels[fishVisualStage(progress).stage];
}

export function cropVisualStageLabel(progress: number, readyYield: number): string {
  const labels: Readonly<Record<CropVisualStage, string>> = {
    seedling: "萌芽",
    leafing: "展叶",
    fruiting: "挂果",
    "harvest-ready": "成熟",
  };
  return labels[cropVisualStage(progress, readyYield).stage];
}

export function animalVisualStageLabel(
  life: Pick<EcosystemLivestockLife, "adults" | "juvenileGrowth"> | undefined,
): string {
  const labels: Readonly<Record<AnimalVisualStage, string>> = {
    baby: "幼崽",
    young: "青年",
    adult: "成年",
  };
  return labels[animalVisualStage(life).stage];
}
