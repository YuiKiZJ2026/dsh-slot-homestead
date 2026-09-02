import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { CurrentGoal } from "./CurrentGoal";

afterEach(cleanup);

describe("CurrentGoal", () => {
  it("prioritizes the next authoritative Token coin when the wallet is empty", () => {
    const state = createInitialState();
    render(<CurrentGoal state={state} tokenProgress={1_850} />);

    expect(screen.getByRole("region", { name: "当前目标" })).toHaveTextContent("下一枚硬币");
    expect(screen.getByText("1,850 / 10,000 实际 Token")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "下一枚硬币进度" }))
      .toHaveAttribute("aria-valuenow", "1850");
  });

  it("shows pity as the single goal before collection goals", () => {
    const state = createInitialState();
    state.wallet = 4;
    state.pityMisses = 7;
    state.displayedCollectibles = ["plant"];
    render(<CurrentGoal state={state} tokenProgress={8_000} />);

    expect(screen.getByText("保底进度")).toBeVisible();
    expect(screen.getByText("7 / 10 · 再 3 次未获新收藏触发保底")).toBeVisible();
    expect(screen.queryByText("静谧书桌")).not.toBeInTheDocument();
  });

  it("turns an incomplete tabletop combo into a concrete placement goal", () => {
    const state = createInitialState();
    state.wallet = 4;
    state.ownedCollectibles = ["plant"];
    state.displayedCollectibles = ["plant"];
    render(<CurrentGoal state={state} />);

    expect(screen.getByText("点亮静谧书桌")).toBeVisible();
    expect(screen.getByText("1 / 2 · 还需要书本底座")).toBeVisible();
  });
});
