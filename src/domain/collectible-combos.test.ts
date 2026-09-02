import { describe, expect, it } from "vitest";
import { createInitialState } from "./types";
import {
  activeCollectibleCombos,
  closestCollectibleCombo,
  comboIdsForDisplayed,
} from "./collectible-combos";

describe("collectible combos", () => {
  it("activates a combo only when every required collectible is displayed", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "book-stand"];
    state.tablePlacements = [
      { itemId: "plant", positionId: "left-rear-round" },
      { itemId: "book-stand", positionId: "left-rear-small" },
    ];

    expect(activeCollectibleCombos(state).map((combo) => combo.id)).toEqual(["focus-nook"]);

    state.tablePlacements.pop();
    expect(activeCollectibleCombos(state)).toEqual([]);
  });

  it("selects the closest incomplete combo as the next placement goal", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant"];
    state.displayedCollectibles = ["plant"];

    expect(closestCollectibleCombo(state)).toMatchObject({
      combo: { id: "focus-nook", name: "静谧书桌" },
      displayedCount: 1,
      totalCount: 2,
      missingItemIds: ["book-stand"],
    });
  });

  it("derives active combo ids from the renderer's displayed item list", () => {
    expect(comboIdsForDisplayed(["toolbox", "mini-robot", "paper-lantern"]))
      .toEqual(["workshop-buddy"]);
    expect(comboIdsForDisplayed(["toolbox", "paper-lantern"]).length).toBe(0);
  });
});
