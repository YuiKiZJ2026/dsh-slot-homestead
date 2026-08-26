import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
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

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(12);
    expect(items[0]).toHaveTextContent("小盆栽");
    expect(items[11]).toHaveTextContent("彗星徽章");
    expect(screen.getByRole("img", { name: "未拥有：书本底座" })).toHaveClass("is-locked");
    expect(screen.getByRole("button", { name: "展示 小盆栽" })).toBeInTheDocument();
    expect(screen.getByText("星夜观测 0 / 3")).toBeInTheDocument();
  });

  it("toggles an owned collectible between display and storage", async () => {
    const onSetDisplayed = vi.fn();
    const state = createInitialState();
    state.ownedCollectibles = ["plant"];
    state.displayedCollectibles = ["plant"];
    render(
      <CollectionPanel open state={state} onClose={() => undefined} onSetDisplayed={onSetDisplayed} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "收起 小盆栽" }));
    expect(onSetDisplayed).toHaveBeenCalledWith("plant", false);
  });
});
