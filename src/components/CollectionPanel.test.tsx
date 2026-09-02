import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { CollectionPanel } from "./CollectionPanel";

afterEach(cleanup);

describe("CollectionPanel", () => {
  it("lists all catalog items in order, masks unowned art, and shows set progress", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant"];
    render(
      <CollectionPanel
        open
        state={state}
        onClose={() => undefined}
        onSetDisplayed={() => undefined}
      />,
    );

    const items = screen.getAllByRole("gridcell");
    expect(items).toHaveLength(12);
    expect(items[0]).toHaveTextContent("小盆栽");
    expect(items[11]).toHaveTextContent("彗星徽章");
    expect(screen.getByRole("grid", { name: "收藏品仓库格子" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "未拥有：书本底座" })).toHaveClass("is-locked");
    expect(screen.getByRole("gridcell", { name: "小盆栽，仓库中，可拖到桌面" })).toHaveAttribute("draggable", "true");
    expect(screen.getByText(/星夜观测 0 \/ 3/)).toBeInTheDocument();
  });

  it("returns a displayed item when it is dragged back over the storage grid", async () => {
    const onSetPlacement = vi.fn();
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "crystal"];
    state.tablePlacements = [
      { itemId: "crystal", positionId: "left-rear-round" },
    ];
    state.displayedCollectibles = ["crystal"];
    render(
      <CollectionPanel
        open
        state={state}
        onClose={() => undefined}
        onSetPlacement={onSetPlacement}
      />,
    );

    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole("gridcell", { name: "发光水晶，桌面上，可拖动" }), {
      dataTransfer: transfer,
    });
    fireEvent.dragOver(screen.getByRole("grid", { name: "收藏品仓库格子" }), {
      dataTransfer: transfer,
    });
    fireEvent.drop(screen.getByRole("grid", { name: "收藏品仓库格子" }), {
      dataTransfer: transfer,
    });
    expect(onSetPlacement).toHaveBeenCalledWith("crystal", null);
  });

  it("surfaces active and nearly completed tabletop combos", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "book-stand"];
    state.tablePlacements = [{ itemId: "plant", positionId: "left-rear-round" }];
    const { rerender } = render(
      <CollectionPanel open state={state} onClose={() => undefined} />,
    );

    expect(screen.getByText("组合提示：静谧书桌 1 / 2")).toBeVisible();

    state.tablePlacements.push({ itemId: "book-stand", positionId: "left-rear-small" });
    rerender(<CollectionPanel open state={state} onClose={() => undefined} />);
    expect(screen.getByText("已点亮：静谧书桌")).toBeVisible();
  });
});

function dataTransfer() {
  const values = new Map<string, string>();
  return {
    effectAllowed: "all",
    dropEffect: "none",
    setData(type: string, value: string) { values.set(type, value); },
    getData(type: string) { return values.get(type) ?? ""; },
  };
}
