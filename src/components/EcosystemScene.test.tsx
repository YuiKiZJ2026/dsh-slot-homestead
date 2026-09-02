import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { EcosystemScene } from "./EcosystemScene";

afterEach(cleanup);

const FISH_VISUAL_CASES = [
  ["goldfish", "fish-gold"],
  ["clownfish", "fish-pearl"],
  ["moon-carp", "fish-stripe"],
] as const;

const CROP_VISUAL_CASES = [
  ["carrot-seed", "1"],
  ["tomato-seed", "2"],
  ["cabbage-seed", "3"],
  ["leafy-seed", "4"],
  ["star-pumpkin", "5"],
  ["onion-seed", "6"],
] as const;

const ANIMAL_VISUAL_CASES = ["chick", "rabbit", "alpaca"] as const;

describe("EcosystemScene", () => {
  it("keeps habitat switching inside the ecosystem side of the shared widget", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);

    expect(screen.getByRole("region", { name: "养成生态" })).toHaveTextContent("鱼缸 1 / 3");
    expect(screen.queryByRole("region", { name: "鱼缸养成抽屉" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "像素鱼缸，里面生活着会游动的鱼和摇摆的水草" }))
      .toHaveAttribute("data-habitat", "aquarium");
    expect(container.querySelectorAll('[data-motion="swim"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-motion="sway"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-motion="rise"]')).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(screen.getByRole("region", { name: "养成生态" })).toHaveTextContent("种植园 2 / 3");
    expect(screen.getByRole("img", { name: "像素种植园，所有作物都在生长和摇摆" }))
      .toHaveAttribute("data-habitat", "garden");
    expect(container.querySelectorAll('[data-motion="grow"]')).toHaveLength(1);
    expect(container.querySelector('.ecosystem-motion-layer--crop-carrot')).toHaveAttribute("data-plot", "1");
    expect(container.querySelector('[data-plot-cell="1"]')).toHaveAttribute("data-plot-anchor", "top-left");
    expect(container.querySelector('[data-plot-cell="1"]')).toHaveAttribute("data-plot-alignment", "visual-center");

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(screen.getByRole("region", { name: "养成生态" })).toHaveTextContent("牧场 3 / 3");
    expect(screen.getByRole("img", { name: "像素牧场，动物会走动、跳跃和啄食" }))
      .toHaveAttribute("data-habitat", "animals");
    expect(container.querySelectorAll('[data-motion="peck"]')).toHaveLength(1);
    expect(container.querySelector('[data-resident-id="chick"]')).toHaveAttribute(
      "data-behavior",
      "wander-peck-drink-rest",
    );
    expect(container.querySelectorAll('[data-motion="hop"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-motion="walk"]')).toHaveLength(0);
  });

  it("matches habitat entrance direction to the arrow and announces the changed title", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);
    const title = screen.getByText("鱼缸 1 / 3 · 鱼苗 0%");

    expect(title).toHaveAttribute("aria-live", "polite");
    expect(title).toHaveAttribute("aria-atomic", "true");

    await userEvent.click(screen.getByRole("button", { name: "上一处养成场景" }));
    expect(container.querySelector(".ecosystem-scene__habitat-stage"))
      .toHaveAttribute("data-transition-direction", "previous");

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(container.querySelector(".ecosystem-scene__habitat-stage"))
      .toHaveAttribute("data-transition-direction", "next");
  });

  it("reveals only residents and crops that have actually been bought or won", async () => {
    const state = createInitialState();
    state.ecosystem.discovered.push(
      "clownfish",
      "moon-carp",
      "tomato-seed",
      "cabbage-seed",
      "leafy-seed",
      "star-pumpkin",
      "onion-seed",
      "rabbit",
      "alpaca",
    );
    const { container } = render(<EcosystemScene state={state} onCare={() => undefined} />);

    expect(container.querySelectorAll('[data-motion="swim"]')).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(container.querySelectorAll('[data-motion="grow"]')).toHaveLength(6);
    expect(Array.from(container.querySelectorAll('[data-motion="grow"]')).map((node) => node.getAttribute("data-plot")))
      .toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(Array.from(container.querySelectorAll('[data-plot-cell]')).map((node) => node.getAttribute("data-plot-anchor")))
      .toEqual(["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(container.querySelectorAll('[data-motion="peck"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-motion="hop"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-motion="walk"]')).toHaveLength(1);
    expect(container.querySelector('[data-resident-id="rabbit"]')).toHaveAttribute(
      "data-behavior",
      "hop-graze-hide-rest",
    );
    expect(container.querySelector('[data-resident-id="alpaca"]')).toHaveAttribute(
      "data-behavior",
      "roam-graze-drink-rest",
    );
  });

  it("builds every habitat inside one unified workbench coordinate space", () => {
    const { container } = render(
      <EcosystemScene
        state={createInitialState()}
        onCare={() => undefined}
        commandBar={<div data-testid="command-bar">工作台控制</div>}
      />,
    );

    expect(container.querySelector(".ecosystem-scene__table-base")).toHaveAttribute(
      "src",
      "/assets/ecosystem-workbench-table-v3.png?v=20260830-single-desk",
    );
    expect(container.querySelector(".ecosystem-scene__equipment-base")).toHaveAttribute(
      "src",
      "/assets/ecosystem-slot-equipment-v3.png?v=20260830-single-desk",
    );
    expect(container.querySelector(".ecosystem-scene__habitat-layer")).toHaveAttribute(
      "src",
      "/assets/ecosystem-reference-aquarium.png",
    );
    expect(container.querySelector(".ecosystem-scene__art")).toHaveAttribute(
      "data-table-layout",
      "single-workbench-704x304",
    );
    expect(container.querySelector(".ecosystem-scene__art")).toHaveAttribute(
      "data-table-seam",
      "none-single-surface",
    );
    expect(container.querySelector(".ecosystem-scene__habitat-bay")).toHaveAttribute(
      "data-safe-rect",
      "32,8,324,218",
    );
    expect(container.querySelector(".ecosystem-scene__habitat-stage")).toHaveAttribute(
      "data-habitat-dock",
      "fixed-ecosystem-bay",
    );
    expect(container.querySelector(".ecosystem-scene__habitat-stage")).toHaveAttribute(
      "data-coordinate-space",
      "workbench-704x304",
    );
    const commandDeck = container.querySelector(".ecosystem-scene__command-deck");
    expect(commandDeck).toHaveAttribute("data-layout", "contextual-one-row");
    expect(commandDeck).toContainElement(container.querySelector(".ecosystem-scene__switcher"));
    expect(container.querySelector(".ecosystem-scene__hud")).not.toBeInTheDocument();
    expect(commandDeck).toContainElement(screen.getByTestId("command-bar"));
  });

  it("keeps habitat controls inside the scene until the player opens that habitat", async () => {
    render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);

    expect(screen.queryByRole("button", { name: "投喂鱼缸" })).not.toBeInTheDocument();
    expect(screen.queryByText("鱼食 1", { exact: true })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("img", {
      name: "像素鱼缸，里面生活着会游动的鱼和摇摆的水草",
    }));

    const drawer = screen.getByRole("region", { name: "鱼缸养成抽屉" });
    expect(drawer).toBeVisible();
    expect(drawer).toHaveTextContent("金鱼");
    expect(drawer).toHaveTextContent("鱼食 1");
    expect(screen.getByRole("button", { name: "投喂鱼缸" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "收起鱼缸养成抽屉" }));
    expect(screen.queryByRole("region", { name: "鱼缸养成抽屉" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "打开鱼缸养成抽屉" }));
    expect(screen.getByRole("region", { name: "鱼缸养成抽屉" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(screen.queryByRole("region", { name: "种植园养成抽屉" })).not.toBeInTheDocument();
  });

  it("keeps the one-piece desk and slot equipment fixed while only the left props switch", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);
    const art = container.querySelector(".ecosystem-scene__art");
    const bay = container.querySelector(".ecosystem-scene__habitat-bay");
    const desk = container.querySelector(".ecosystem-scene__table-base");
    const equipment = container.querySelector(".ecosystem-scene__equipment-base");
    const aquariumStage = container.querySelector(".ecosystem-scene__habitat-stage");

    expect(aquariumStage?.querySelectorAll('[src*="workbench"], [src*="scene-base"], [src*="table"]'))
      .toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));

    const gardenStage = container.querySelector(".ecosystem-scene__habitat-stage");
    expect(container.querySelector(".ecosystem-scene__art")).toBe(art);
    expect(container.querySelector(".ecosystem-scene__habitat-bay")).toBe(bay);
    expect(container.querySelector(".ecosystem-scene__table-base")).toBe(desk);
    expect(container.querySelector(".ecosystem-scene__equipment-base")).toBe(equipment);
    expect(gardenStage).not.toBe(aquariumStage);
    expect(gardenStage?.querySelector('[data-habitat-prop="watering-can"]')).toHaveAttribute(
      "src",
      "/assets/ecosystem-garden-watering-can-v3.png",
    );
    expect(gardenStage?.querySelectorAll('[src*="workbench"], [src*="scene-base"], [src*="table"]'))
      .toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(container.querySelector('[data-habitat-prop="watering-can"]')).not.toBeInTheDocument();
    expect(container.querySelector(".ecosystem-scene__table-base")).toBe(desk);
    expect(container.querySelector(".ecosystem-scene__equipment-base")).toBe(equipment);
  });

  it("switches a dedicated pixel lamp with each habitat and keeps the garden scarecrow", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);

    expect(container.querySelector('[data-habitat-prop="aquarium-lamp"]')).toBeInTheDocument();
    expect(container.querySelector('[data-night-glow="aquarium"]')).toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="garden-lamp"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="scarecrow"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="pasture-lamp"]')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));

    expect(container.querySelector('[data-habitat-prop="aquarium-lamp"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="garden-lamp"]')).toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="scarecrow"]')).toBeInTheDocument();
    expect(container.querySelector('[data-night-glow="garden"]')).toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="pasture-lamp"]')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));

    expect(container.querySelector('[data-habitat-prop="garden-lamp"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="scarecrow"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-habitat-prop="pasture-lamp"]')).toBeInTheDocument();
    expect(container.querySelector('[data-night-glow="animals"]')).toBeInTheDocument();
  });

  it("marks every ambient decoration as non-interactive so it cannot block habitat controls", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);

    const expectDecorationsToBePassive = () => {
      const decorations = container.querySelectorAll(
        '[data-habitat-prop$="-lamp"], [data-habitat-prop="scarecrow"], [data-night-glow], [data-night-hotspot], [data-night-rest]',
      );
      expect(decorations.length).toBeGreaterThan(0);
      decorations.forEach((decoration) => {
        expect(decoration).toHaveAttribute("aria-hidden", "true");
      });
    };

    expectDecorationsToBePassive();
    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expectDecorationsToBePassive();
    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expectDecorationsToBePassive();
  });

  it("gives every habitat a named night-light cast and a separate bright hotspot", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);

    const expectLighting = (
      habitat: "aquarium" | "garden" | "animals",
      cast: "tank-wash" | "garden-pool" | "left",
    ) => {
      expect(container.querySelector(`[data-night-glow="${habitat}"]`))
        .toHaveAttribute("data-light-cast", cast);
      expect(container.querySelector(`[data-night-glow="${habitat}"]`))
        .toHaveAttribute("data-light-motion", "steady");
      const hotspot = container.querySelector(`[data-night-hotspot="${habitat}"]`);
      expect(hotspot).toHaveAttribute("aria-hidden", "true");
      expect(hotspot).toHaveAttribute("data-light-role", "wick");
      expect(hotspot).toHaveAttribute("data-light-motion", "flicker");
    };

    expectLighting("aquarium", "tank-wash");
    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expectLighting("garden", "garden-pool");
    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expectLighting("animals", "left");
  });

  it("faces the pasture lantern left and provides a passive night-rest layer", async () => {
    const state = createInitialState();
    const { container, rerender } = render(
      <EcosystemScene state={state} dayPhase="night" onCare={() => undefined} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "上一处养成场景" }));

    expect(container.querySelector('[data-habitat-prop="pasture-lamp"]'))
      .toHaveAttribute("data-lamp-facing", "left");
    expect(container.querySelector('[data-night-rest="animals"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector('[data-night-rest="animals"]')).toHaveAttribute(
      "data-rest-kind",
      "sleeping-animals",
    );
    expect(container.querySelector('[data-night-rest="animals"]')).toHaveAttribute(
      "data-routine-state",
      "resting",
    );
    expect(container.querySelector('[data-resident-id]')).not.toBeInTheDocument();

    rerender(<EcosystemScene state={state} dayPhase="day" onCare={() => undefined} />);
    expect(container.querySelector('[data-night-rest="animals"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-resident-id="chick"]')).toHaveAttribute(
      "data-routine-state",
      "active",
    );
  });

  it("shows a distinct local reaction when the player clicks a resident in every habitat", async () => {
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={() => undefined} />);

    const habitatStage = () => container.querySelector(".ecosystem-scene__habitat-stage");
    const reactionStatus = () => habitatStage()?.querySelector<HTMLElement>('[role="status"]');

    const goldfish = screen.getByRole("button", { name: "与金鱼互动" });
    await userEvent.click(goldfish);
    expect(reactionStatus()).toHaveAttribute("data-reaction-kind", "fish");
    expect(reactionStatus()).toHaveTextContent("金鱼追着手指游了过来");
    expect(reactionStatus()?.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/ecosystem-reaction-fish.png",
    );
    const firstSequence = Number(reactionStatus()?.dataset.reactionSequence);
    const firstFeedbackFrame = goldfish.querySelector(".ecosystem-resident-feedback-frame");
    await userEvent.click(goldfish);
    expect(Number(reactionStatus()?.dataset.reactionSequence)).toBeGreaterThan(firstSequence);
    expect(goldfish.querySelector(".ecosystem-resident-feedback-frame")).not.toBe(firstFeedbackFrame);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    await userEvent.click(screen.getByRole("button", { name: "与胡萝卜种子互动" }));
    expect(reactionStatus()).toHaveAttribute("data-reaction-kind", "crop");
    expect(reactionStatus()).toHaveTextContent("胡萝卜幼苗轻轻晃了晃叶子");
    expect(reactionStatus()?.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/ecosystem-reaction-crop.png",
    );

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    await userEvent.click(screen.getByRole("button", { name: "与小鸡互动" }));
    expect(reactionStatus()).toHaveAttribute("data-reaction-kind", "animal");
    expect(reactionStatus()).toHaveTextContent("小鸡开心地跑来啄了啄");
    expect(reactionStatus()?.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/ecosystem-reaction-animal.png",
    );
  });

  it("uses the matching supply when the user cares for the visible habitat", async () => {
    const onCare = vi.fn();
    render(<EcosystemScene state={createInitialState()} onCare={onCare} />);

    await userEvent.click(screen.getByRole("button", { name: "打开鱼缸养成抽屉" }));
    await userEvent.click(screen.getByRole("button", { name: "投喂鱼缸" }));

    expect(onCare).toHaveBeenCalledWith("aquarium");
    expect(screen.getByText("鱼食 1")).toBeVisible();
  });

  it("restarts one local care confirmation for every enabled care click", async () => {
    const onCare = vi.fn();
    const { container } = render(<EcosystemScene state={createInitialState()} onCare={onCare} />);
    await userEvent.click(screen.getByRole("button", { name: "打开鱼缸养成抽屉" }));
    const careButton = screen.getByRole("button", { name: "投喂鱼缸" });

    await userEvent.click(careButton);
    const firstFeedback = container.querySelector<HTMLElement>(".ecosystem-scene__care-feedback");
    const firstSequence = Number(firstFeedback?.dataset.careSequence);
    expect(firstFeedback).toHaveAttribute("aria-hidden", "true");
    expect(firstFeedback).toHaveAttribute("data-care-habitat", "aquarium");

    await userEvent.click(careButton);
    const secondFeedback = container.querySelector<HTMLElement>(".ecosystem-scene__care-feedback");
    expect(onCare).toHaveBeenCalledTimes(2);
    expect(secondFeedback).not.toBe(firstFeedback);
    expect(Number(secondFeedback?.dataset.careSequence)).toBeGreaterThan(firstSequence);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    expect(container.querySelector(".ecosystem-scene__care-feedback")).not.toBeInTheDocument();
  });

  it("explains that natural growth continues when no acceleration supply remains", async () => {
    const state = createInitialState();
    state.ecosystem.supplies.fishFeed = 0;
    render(<EcosystemScene state={state} onCare={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "打开鱼缸养成抽屉" }));
    expect(screen.getByRole("button", { name: "投喂鱼缸" })).toBeDisabled();
    expect(screen.getByText("鱼食用完了，仍会自然成长；补给后可加速")).toBeVisible();
  });

  it("shows the selected fish life stage and real time-based growth", async () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.fish.goldfish!.growth = 55;
    const onCollect = vi.fn();
    const { container } = render(
      <EcosystemScene state={state} onCare={() => undefined} onCollect={onCollect} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "打开鱼缸养成抽屉" }));

    const drawer = screen.getByRole("region", { name: "鱼缸养成抽屉" });
    expect(drawer).toHaveTextContent(/阶段：青年鱼/);
    expect(drawer).toHaveTextContent(/成长 55%/);
    expect(container.querySelector('[data-resident-id="goldfish"]')).toHaveAttribute(
      "data-growth-stage",
      "growing",
    );
  });

  it("keeps the active habitat stage and growth visible without opening its drawer", () => {
    const initial = createInitialState();
    const advanced = createInitialState();
    advanced.ecosystem.lifecycle.fish.goldfish!.growth = 24;
    const { container, rerender } = render(
      <EcosystemScene state={initial} onCare={() => undefined} />,
    );

    expect(screen.queryByRole("region", { name: "鱼缸养成抽屉" })).not.toBeInTheDocument();
    expect(screen.getByText(/鱼缸 1 \/ 3.*鱼苗 0%/)).toBeVisible();
    expect(container.querySelector('[data-resident-id="goldfish"]')).toHaveAttribute(
      "data-growth-progress",
      "0",
    );

    rerender(<EcosystemScene state={advanced} onCare={() => undefined} />);

    expect(screen.getByText(/鱼缸 1 \/ 3.*幼鱼 24%/)).toBeVisible();
    expect(container.querySelector('[data-resident-id="goldfish"]')).toHaveAttribute(
      "data-growth-progress",
      "24",
    );
    expect(container.querySelector('[data-resident-id="goldfish"]')).toHaveAttribute(
      "data-visual-stage",
      "juvenile",
    );
  });

  it.each(FISH_VISUAL_CASES)(
    "switches %s through four genuinely different fish frames",
    (residentId, layerId) => {
      const base = createInitialState();
      if (!base.ecosystem.discovered.includes(residentId)) {
        base.ecosystem.discovered.push(residentId);
      }
      base.ecosystem.lifecycle.fish[residentId] = {
        count: 1,
        growth: 0,
        boostedUntil: null,
      };
      const { container, rerender } = render(
        <EcosystemScene state={base} onCare={() => undefined} />,
      );
      const resident = () => container.querySelector(`[data-resident-id="${residentId}"]`);

      expect(resident()).toHaveAttribute("data-visual-stage", "fry");
      expect(resident()).toHaveAttribute("data-sprite-frame", "0");
      expect(resident()?.querySelector(".ecosystem-resident-sprite"))
        .toHaveAttribute("data-sprite-sheet", layerId);

      for (const [growth, visualStage, frame] of [
        [30, "juvenile", "1"],
        [70, "young", "2"],
        [100, "adult", "3"],
      ] as const) {
        const next = structuredClone(base);
        next.ecosystem.lifecycle.fish[residentId]!.growth = growth;
        rerender(<EcosystemScene state={next} onCare={() => undefined} />);
        expect(resident()).toHaveAttribute("data-visual-stage", visualStage);
        expect(resident()).toHaveAttribute("data-sprite-frame", frame);
      }
    },
  );

  it.each(CROP_VISUAL_CASES)(
    "switches %s through seedling, leafing, fruiting, and harvest-ready art",
    async (residentId, plotId) => {
      const base = createInitialState();
      if (!base.ecosystem.discovered.includes(residentId)) {
        base.ecosystem.discovered.push(residentId);
      }
      base.ecosystem.lifecycle.plots[plotId] = {
        seedId: residentId,
        growth: 0,
        readyYield: 0,
        boostedUntil: null,
        generation: 1,
      };
      const { container, rerender } = render(
        <EcosystemScene state={base} onCare={() => undefined} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
      const resident = () => container.querySelector(`[data-resident-id="${residentId}"]`);

      for (const [growth, readyYield, visualStage, frame] of [
        [0, 0, "seedling", "0"],
        [30, 0, "leafing", "1"],
        [70, 0, "fruiting", "2"],
        [100, 1, "harvest-ready", "3"],
      ] as const) {
        const next = structuredClone(base);
        next.ecosystem.lifecycle.plots[plotId]!.growth = growth;
        next.ecosystem.lifecycle.plots[plotId]!.readyYield = readyYield;
        rerender(<EcosystemScene state={next} onCare={() => undefined} />);
        expect(resident()).toHaveAttribute("data-visual-stage", visualStage);
        expect(resident()).toHaveAttribute("data-sprite-frame", frame);
      }
    },
  );

  it.each(ANIMAL_VISUAL_CASES)(
    "uses separate baby, young, and adult art for %s",
    async (residentId) => {
      const base = createInitialState();
      if (!base.ecosystem.discovered.includes(residentId)) {
        base.ecosystem.discovered.push(residentId);
      }
      base.ecosystem.lifecycle.livestock[residentId] = {
        adults: 0,
        juveniles: 1,
        juvenileGrowth: 10,
        production: 0,
        readyProducts: 0,
        boostedUntil: null,
        generation: 1,
      };
      const { container, rerender } = render(
        <EcosystemScene state={base} onCare={() => undefined} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "上一处养成场景" }));
      const resident = () => container.querySelector(`[data-resident-id="${residentId}"]`);

      expect(resident()).toHaveAttribute("data-visual-stage", "baby");
      expect(resident()).toHaveAttribute("data-sprite-frame", "0");

      const young = structuredClone(base);
      young.ecosystem.lifecycle.livestock[residentId]!.juvenileGrowth = 70;
      rerender(<EcosystemScene state={young} onCare={() => undefined} />);
      expect(resident()).toHaveAttribute("data-visual-stage", "young");
      expect(resident()).toHaveAttribute("data-sprite-frame", "1");

      const adult = structuredClone(base);
      adult.ecosystem.lifecycle.livestock[residentId] = {
        ...adult.ecosystem.lifecycle.livestock[residentId]!,
        adults: 1,
        juveniles: 0,
        juvenileGrowth: 0,
      };
      rerender(<EcosystemScene state={adult} onCare={() => undefined} />);
      expect(resident()).toHaveAttribute("data-visual-stage", "adult");
      expect(resident()).toHaveAttribute("data-sprite-frame", "2");
    },
  );

  it("places eggs on the pasture while newborn animals live beside their parents", async () => {
    const state = createInitialState();
    const onCollect = vi.fn();
    state.ecosystem.discovered.push("rabbit", "alpaca");
    for (const residentId of ANIMAL_VISUAL_CASES) {
      state.ecosystem.lifecycle.livestock[residentId] = {
        adults: 1,
        juveniles: residentId === "chick" ? 0 : 1,
        juvenileGrowth: residentId === "chick" ? 0 : 10,
        production: 0,
        readyProducts: residentId === "chick" ? 1 : 0,
        boostedUntil: null,
        generation: 2,
      };
    }
    const { container } = render(
      <EcosystemScene state={state} onCare={() => undefined} onCollect={onCollect} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "上一处养成场景" }));

    expect(container.querySelector('[data-ground-produce="egg"]')).toHaveAttribute(
      "data-ground-produce-count",
      "1",
    );
    expect(container.querySelector('[data-ground-produce="rabbit-kit"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-ground-produce="alpaca-cria"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-animal-companion="juvenile"][data-resident-id="rabbit"]'))
      .toHaveAttribute("data-visual-stage", "baby");
    expect(container.querySelector('[data-animal-companion="juvenile"][data-resident-id="alpaca"]'))
      .toHaveAttribute("data-visual-stage", "baby");
    await userEvent.click(screen.getByRole("button", { name: "拾取鸡蛋 1" }));
    expect(onCollect).toHaveBeenCalledWith("animals");
  });

  it("collects one mature crop and prevents the scene from hiding its ready state", async () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.plots["1"] = {
      ...state.ecosystem.lifecycle.plots["1"],
      growth: 100,
      readyYield: 1,
    };
    const onCollect = vi.fn();
    const { container } = render(
      <EcosystemScene state={state} onCare={() => undefined} onCollect={onCollect} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    await userEvent.click(screen.getByRole("button", { name: "打开种植园养成抽屉" }));

    expect(screen.getByText(/胡萝卜.*可收获/)).toBeVisible();
    expect(container.querySelector('[data-resident-id="carrot-seed"]')).toHaveAttribute(
      "data-growth-stage",
      "ready",
    );
    await userEvent.click(screen.getByRole("button", { name: "收获" }));
    expect(onCollect).toHaveBeenCalledWith("garden");
  });

  it("enables one habitat harvest when a non-selected plot is ready", async () => {
    const state = createInitialState();
    state.ecosystem.discovered.push("tomato-seed");
    state.ecosystem.lifecycle.plots["2"] = {
      seedId: "tomato-seed",
      growth: 100,
      readyYield: 1,
      boostedUntil: null,
      generation: 1,
    };
    const onCollect = vi.fn();
    render(<EcosystemScene state={state} onCare={() => undefined} onCollect={onCollect} />);

    await userEvent.click(screen.getByRole("button", { name: "下一处养成场景" }));
    await userEvent.click(screen.getByRole("button", { name: "打开种植园养成抽屉" }));

    expect(screen.getByText(/产出：番茄 ×1/)).toBeVisible();
    const harvest = screen.getByRole("button", { name: "收获" });
    expect(harvest).toBeEnabled();
    await userEvent.click(harvest);
    expect(onCollect).toHaveBeenCalledWith("garden");
  });

  it("shows adult livestock output and sends one explicit collect action", async () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.livestock.chick = {
      ...state.ecosystem.lifecycle.livestock.chick!,
      adults: 1,
      juveniles: 0,
      juvenileGrowth: 100,
      readyProducts: 1,
    };
    const onCollect = vi.fn();
    render(<EcosystemScene state={state} onCare={() => undefined} onCollect={onCollect} />);

    await userEvent.click(screen.getByRole("button", { name: "上一处养成场景" }));
    await userEvent.click(screen.getByRole("button", { name: "打开牧场养成抽屉" }));

    expect(screen.getByText(/成鸡/)).toBeVisible();
    expect(screen.getByText(/鸡蛋待领取 1/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "收获" }));
    expect(onCollect).toHaveBeenCalledWith("animals");
  });
});
