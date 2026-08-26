import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { ShopPanel } from "./ShopPanel";

afterEach(cleanup);

describe("ShopPanel", () => {
  it("buys an affordable unowned common item and disables owned items", async () => {
    const state = createInitialState();
    state.wallet = 6;
    const onBuy = vi.fn();
    const { rerender } = render(
      <ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />,
    );

    expect(screen.getByTestId("shop-price-plant")).toHaveTextContent("6 枚");
    await userEvent.click(screen.getByRole("button", { name: "购买 小盆栽" }));
    expect(onBuy).toHaveBeenCalledWith("plant");

    state.ownedCollectibles = ["plant"];
    rerender(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />);
    expect(screen.getByRole("button", { name: "已拥有 小盆栽" })).toBeDisabled();
  });

  it("shows fixed catalog prices and disables unaffordable purchases", () => {
    const state = createInitialState();
    state.wallet = 17;
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={() => undefined} />);

    expect(screen.getByTestId("shop-price-crystal")).toHaveTextContent("18 枚");
    expect(screen.getByRole("button", { name: "余额不足 发光水晶" })).toBeDisabled();
    expect(screen.getByTestId("shop-price-star-projector")).toHaveTextContent("30 枚");
  });

  it("disables purchase of the new collectible locked by the active spin", () => {
    const state = createInitialState();
    state.wallet = 6;
    state.activeSpin = {
      id: "spin-locked-plant",
      stage: "highlight",
      reels: ["leaf", "leaf", "leaf"],
      reward: {
        kind: "collectible",
        collectibleId: "plant",
        isDuplicate: false,
        conversionCoins: 0,
        bonusCoins: 0,
      },
      pityAfter: 0,
      createdAt: "2026-08-26T00:00:00.000Z",
    };

    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={() => undefined} />);

    expect(screen.getByRole("button", { name: "待领取 小盆栽" })).toBeDisabled();
  });
});
