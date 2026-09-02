import { describe, expect, it } from "vitest";
import {
  ECOSYSTEM_TABLE_WIDTH,
  HABITAT_SAFE_RECT,
  SLOT_CANVAS_RECT,
  SLOT_STATIC_CROP_LEFT,
  TABLE_FRONT_Y,
  WORKBENCH_STAGE,
  habitatStageRect,
  habitatVisibleRect,
} from "./workbench-layout";

describe("unified workbench layout", () => {
  it("uses one world coordinate system for the ecosystem and slot machine", () => {
    expect(WORKBENCH_STAGE).toEqual({ width: 704, height: 304 });
    expect(SLOT_CANVAS_RECT).toEqual({ x: 320, y: 0, width: 384, height: 288 });
    expect(TABLE_FRONT_Y).toBe(228);
  });

  it("removes the slot table's second outside edge at the single static join", () => {
    const staticJoin = SLOT_CANVAS_RECT.x + SLOT_STATIC_CROP_LEFT;

    expect(staticJoin).toBe(389);
    expect(staticJoin - ECOSYSTEM_TABLE_WIDTH).toBe(29);
    expect(staticJoin - HABITAT_SAFE_RECT.right).toBeGreaterThanOrEqual(64);
  });

  it("keeps the complete garden watering can on the sloped tabletop during entry", () => {
    const stage = habitatStageRect("garden");
    const scale = stage.width / 784;
    const wateringCanLeft = stage.x + 11 * scale;
    const wateringCanRight = stage.x + 160 * scale;

    expect(wateringCanLeft).toBeGreaterThanOrEqual(47.99);
    expect(wateringCanRight).toBeLessThanOrEqual(HABITAT_SAFE_RECT.right);
    expect(wateringCanLeft - 8).toBeGreaterThanOrEqual(HABITAT_SAFE_RECT.left);
  });

  it.each(["aquarium", "garden", "animals"] as const)(
    "contains the complete %s artwork inside the fixed habitat safety area",
    (habitat) => {
      const visible = habitatVisibleRect(habitat);

      expect(visible.left).toBeGreaterThanOrEqual(HABITAT_SAFE_RECT.left - 0.1);
      expect(visible.right).toBeLessThanOrEqual(HABITAT_SAFE_RECT.right + 0.1);
      expect(visible.top).toBeGreaterThanOrEqual(HABITAT_SAFE_RECT.top - 0.1);
      expect(visible.bottom).toBeLessThanOrEqual(HABITAT_SAFE_RECT.bottom + 0.1);
      expect(visible.bottom).toBeLessThan(TABLE_FRONT_Y);
    },
  );
});
