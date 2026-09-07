import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { COLLECTIBLES } from "../domain/catalog";
import { ShopPanel } from "./ShopPanel";

afterEach(cleanup);

describe("ShopPanel", () => {
  it("opens a keyboard-accessible growth reference without changing the player's ecosystem", async () => {
    const state = createInitialState();
    const before = JSON.stringify(state);
    const onBuy = vi.fn();
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} mutationsDisabled />);
    const opener = screen.getByRole("button", { name: "查看金鱼成长图鉴" });
    opener.focus();
    await userEvent.keyboard("{Enter}");
    const viewer = screen.getByRole("region", { name: "金鱼成长图鉴" });
    expect(viewer).toHaveFocus();
    expect(viewer).toHaveTextContent("外观参考，不代表当前养成进度");
    expect(within(viewer).getByRole("img", { name: "金鱼：鱼苗（外观参考）" })).toHaveAttribute("data-sprite-cell", "0:0");
    await userEvent.click(within(viewer).getByRole("button", { name: "成鱼" }));
    expect(within(viewer).getByRole("button", { name: "成鱼" })).toHaveAttribute("aria-pressed", "true");
    expect(within(viewer).getByRole("img", { name: "金鱼：成鱼（外观参考）" })).toHaveAttribute("data-sprite-cell", "0:3");
    expect(onBuy).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
    await userEvent.click(within(viewer).getByRole("button", { name: "关闭金鱼成长图鉴" }));
    expect(screen.queryByRole("region", { name: "金鱼成长图鉴" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("shows only one stage viewer and resets reference frames across visits", async () => {
    const props = { state: createInitialState(), onClose: () => undefined, onBuy: () => undefined };
    const { rerender } = render(<ShopPanel open {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "查看金鱼成长图鉴" }));
    await userEvent.click(screen.getByRole("button", { name: "查看垂耳兔成长图鉴" }));
    expect(screen.queryByRole("region", { name: "金鱼成长图鉴" })).not.toBeInTheDocument();
    const rabbit = screen.getByRole("region", { name: "垂耳兔成长图鉴" });
    expect(within(rabbit).getByRole("group", { name: "垂耳兔成长阶段" }).children).toHaveLength(3);
    await userEvent.click(within(rabbit).getByRole("button", { name: "成年" }));
    expect(within(rabbit).getByRole("img")).toHaveAttribute("data-sprite-cell", "1:2");
    await userEvent.click(screen.getByRole("button", { name: "查看垂耳兔成长图鉴" }));
    expect(screen.queryByRole("region", { name: "垂耳兔成长图鉴" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "查看垂耳兔成长图鉴" }));
    expect(within(screen.getByRole("region", { name: "垂耳兔成长图鉴" })).getByRole("img")).toHaveAttribute("data-sprite-cell", "1:0");
    rerender(<ShopPanel open={false} {...props} />);
    rerender(<ShopPanel open {...props} />);
    expect(screen.queryByRole("region", { name: "垂耳兔成长图鉴" })).not.toBeInTheDocument();
  });

  it("shows real crop stages and closes a reference when browsing filters change", async () => {
    render(<ShopPanel open state={createInitialState()} onClose={() => undefined} onBuy={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "查看番茄种子成长图鉴" }));
    const crop = screen.getByRole("region", { name: "番茄种子成长图鉴" });
    expect(within(crop).getByRole("button", { name: "萌芽" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(crop).getByRole("button", { name: "挂果" }));
    expect(within(crop).getByRole("img")).toHaveAttribute("data-sprite-cell", "1:2");
    await userEvent.click(screen.getByRole("button", { name: "居民" }));
    expect(screen.queryByRole("region", { name: "番茄种子成长图鉴" })).not.toBeInTheDocument();
  });

  it("filters categories and search together, then clears the search without losing the category", async () => {
    render(<ShopPanel open state={createInitialState()} onClose={() => undefined} onBuy={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "居民" }));
    expect(screen.getByRole("button", { name: "居民" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("常驻制作")).not.toBeInTheDocument();
    expect(screen.queryByText("饲料与肥料")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("12 件");

    await userEvent.type(screen.getByRole("searchbox", { name: "搜索工坊" }), "种植园");
    expect(screen.getByText("胡萝卜种子")).toBeVisible();
    expect(screen.queryByText("金鱼")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("6 件");

    await userEvent.click(screen.getByRole("button", { name: "清空搜索" }));
    expect(screen.getByRole("searchbox", { name: "搜索工坊" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "居民" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("12 件");
  });

  it("offers a recoverable empty result and resets a closed workshop for its next visit", async () => {
    const props = { state: createInitialState(), onClose: () => undefined, onBuy: () => undefined };
    const { rerender } = render(<ShopPanel open {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "补给" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "搜索工坊" }), "不存在");
    expect(screen.getByRole("status")).toHaveTextContent("没有找到");
    expect(screen.queryByText("饲料与肥料")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "查看全部物品" }));
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox", { name: "搜索工坊" })).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "摆件" }));
    rerender(<ShopPanel open={false} {...props} />);
    rerender(<ShopPanel open {...props} />);
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows each resident's mature portrait and preserves the exact purchase intent", async () => {
    const state = createInitialState();
    state.wallet = 30;
    const onBuy = vi.fn();
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} assetUrls={{ fishPearl: "/plugin/clownfish.svg" }} />);
    const row = screen.getByText("小丑鱼").closest("li")!;
    expect(row.querySelector("[data-item-portrait=clownfish]")).toHaveAttribute("data-sprite-cell", "1:3");
    expect(row.querySelector("[data-item-portrait=clownfish]")).toHaveStyle({ backgroundImage: 'url("/plugin/clownfish.svg")' });
    await userEvent.click(within(row).getByRole("button", { name: "购买 小丑鱼" }));
    expect(onBuy).toHaveBeenCalledExactlyOnceWith("clownfish");
  });

  it("keeps earned set progress when search hides its collectibles", async () => {
    const state = createInitialState();
    state.ownedCollectibles = COLLECTIBLES.filter(item => item.rarity === "set").map(item => item.id);
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={() => undefined} />);

    await userEvent.type(screen.getByRole("searchbox", { name: "搜索工坊" }), "肥料");
    expect(screen.getByRole("region", { name: "星夜改装进度" })).toHaveTextContent("星夜改装 3 / 3");
    expect(screen.getByRole("region", { name: "星夜改装进度" })).toHaveTextContent("星夜桌面已启用");
  });

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

  it("keeps owned residents and mutation-disabled purchases unavailable", async () => {
    const state = createInitialState();
    state.wallet = 30;
    state.ecosystem.discovered = ["goldfish"];
    const onBuy = vi.fn();
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} mutationsDisabled />);
    expect(screen.getByRole("button", { name: "已拥有 金鱼" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "购买 小丑鱼" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "购买 鱼食" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "购买 小丑鱼" }));
    expect(onBuy).not.toHaveBeenCalled();
  });

  it("keeps the active ecosystem reward reserved while the categories remain browsable", async () => {
    const state = createInitialState();
    state.wallet = 30;
    state.activeSpin = {
      id: "spin-locked-clownfish", stage: "highlight", reels: ["leaf", "leaf", "leaf"],
      reward: { kind: "ecosystem-item", itemId: "clownfish", isDuplicate: false, conversionCoins: 0 },
      pityAfter: 0, createdAt: "2026-09-07T00:00:00.000Z",
    };
    render(<ShopPanel open state={state} onClose={() => undefined} onBuy={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "居民" }));
    expect(screen.getByRole("button", { name: "待领取 小丑鱼" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "补给" }));
    expect(screen.getByRole("button", { name: "购买 鱼食" })).toBeEnabled();
  });
});
