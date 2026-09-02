import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { ShopPanel } from "./ShopPanel";

afterEach(cleanup);

describe("ShopPanel", () => {
  it("works as a pixel workshop for craftable common items", async () => {
    const state = createInitialState();
    state.wallet = 6;
    const onBuy = vi.fn();
    const { rerender } = render(
      <ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />,
    );

    expect(screen.getByRole("dialog", { name: "像素工坊" })).toBeVisible();
    expect(screen.getByText("常驻制作")).toBeVisible();
    expect(screen.getByTestId("shop-price-plant")).toHaveTextContent("6 枚");
    await userEvent.click(screen.getByRole("button", { name: "购买 小盆栽" }));
    expect(onBuy).toHaveBeenCalledWith("plant");

    state.ownedCollectibles = ["plant"];
    rerender(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />);
    expect(screen.getByRole("button", { name: "已拥有 小盆栽" })).toBeDisabled();
  });

  it("keeps rare and set collectibles as discovery goals instead of direct purchases", () => {
    const state = createInitialState();
    state.wallet = 17;
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={() => undefined} />);

    expect(screen.getByText("稀有发现")).toBeVisible();
    expect(screen.getByText("发光水晶")).toBeVisible();
    expect(screen.getAllByText("通过拉杆或保底发现").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "购买 发光水晶" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "星夜改装进度" }))
      .toHaveTextContent("星夜改装 0 / 3");
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

  it("sells new residents and repeatable supplies with the same coin wallet", async () => {
    const state = createInitialState();
    state.wallet = 20;
    const onBuy = vi.fn();
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />);

    expect(screen.getByText("生态居民")).toBeVisible();
    expect(screen.getByText("5 枚 · 种植园")).toBeVisible();
    expect(screen.getByText("7 枚 · 牧场")).toBeVisible();
    expect(screen.getByText("饲料与肥料")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "购买 小丑鱼" }));
    await userEvent.click(screen.getByRole("button", { name: "购买 鱼食" }));

    expect(onBuy).toHaveBeenCalledWith("clownfish");
    expect(onBuy).toHaveBeenCalledWith("fish-feed");
  });
});
