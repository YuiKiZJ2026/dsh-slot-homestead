import { describe, expect, it } from "vitest";
import {
  animalVisualStageLabel,
  cropVisualStageLabel,
  fishVisualStageLabel,
} from "./visual-stage";

describe("visual stage labels", () => {
  it("names every visible fish stage differently", () => {
    expect([0, 20, 55, 100].map(fishVisualStageLabel))
      .toEqual(["鱼苗", "幼鱼", "青年鱼", "成鱼"]);
  });

  it("names every visible crop stage differently", () => {
    expect([
      cropVisualStageLabel(0, 0),
      cropVisualStageLabel(20, 0),
      cropVisualStageLabel(55, 0),
      cropVisualStageLabel(100, 1),
    ]).toEqual(["萌芽", "展叶", "挂果", "成熟"]);
  });

  it("distinguishes baby, young, and adult animals", () => {
    expect([
      animalVisualStageLabel({ adults: 0, juvenileGrowth: 0 }),
      animalVisualStageLabel({ adults: 0, juvenileGrowth: 18 }),
      animalVisualStageLabel({ adults: 1, juvenileGrowth: 0 }),
    ]).toEqual(["幼崽", "青年", "成年"]);
  });
});
