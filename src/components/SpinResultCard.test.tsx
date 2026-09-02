import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState, type ResolvedSpin } from "../domain/types";
import { SpinResultCard } from "./SpinResultCard";

afterEach(cleanup);

describe("SpinResultCard", () => {
  it("lets a newly discovered collectible move directly onto the first free table position", async () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant", "star-projector", "constellation-globe"];
    state.tablePlacements = [{ itemId: "plant", positionId: "left-rear-round" }];
    const onPlace = vi.fn();
    const onDismiss = vi.fn();

    render(
      <SpinResultCard
        spin={collectibleSpin("comet-badge")}
        state={state}
        onPlace={onPlace}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("dialog", { name: "开奖结果" })).toHaveTextContent("首次发现");
    expect(screen.getByText("彗星徽章")).toBeVisible();
    expect(screen.getByText("星夜观测 3 / 3 · 星夜桌面已解锁")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "把 彗星徽章 摆上桌面" }));
    expect(onPlace).toHaveBeenCalledWith("comet-badge", "left-rear-small");
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps a new collectible in storage when the player dismisses the card", async () => {
    const state = createInitialState();
    state.ownedCollectibles = ["crystal"];
    const onPlace = vi.fn();
    const onDismiss = vi.fn();
    render(
      <SpinResultCard
        spin={collectibleSpin("crystal")}
        state={state}
        onPlace={onPlace}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "把 发光水晶 收进收藏盒" }));
    expect(onPlace).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("explains duplicate conversion and ordinary coin rewards", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["crystal"];
    const duplicate = collectibleSpin("crystal", true);
    duplicate.reward = {
      kind: "collectible",
      collectibleId: "crystal",
      isDuplicate: true,
      conversionCoins: 9,
      bonusCoins: 3,
    };
    const { rerender } = render(
      <SpinResultCard spin={duplicate} state={state} onDismiss={() => undefined} />,
    );

    expect(screen.getByText("重复收藏：发光水晶")).toBeVisible();
    expect(screen.getByText("已自动折算为 12 枚硬币")).toBeVisible();
    expect(screen.queryByRole("button", { name: /摆上桌面/ })).not.toBeInTheDocument();

    rerender(
      <SpinResultCard
        spin={{ ...duplicate, reward: { kind: "coins", amount: 5, reason: "five-coins" } }}
        state={state}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText("获得 5 枚硬币")).toBeVisible();
    expect(screen.getByText("三枚金币连线奖励")).toBeVisible();
  });

  it("explains new and duplicate ecosystem rewards", () => {
    const state = createInitialState();
    const ecosystemSpin: ResolvedSpin = {
      id: "spin-moon-carp",
      stage: "settled",
      reels: ["leaf", "leaf", "leaf"],
      reward: {
        kind: "ecosystem-item",
        itemId: "moon-carp",
        isDuplicate: false,
        conversionCoins: 0,
      },
      pityAfter: 0,
      createdAt: "2026-08-29T00:00:00.000Z",
    };
    const { rerender } = render(
      <SpinResultCard spin={ecosystemSpin} state={state} onDismiss={() => undefined} />,
    );

    expect(screen.getByText("新居民：月光锦鲤")).toBeVisible();
    expect(screen.getByText("已送到鱼缸，可以在右侧场景里照料它。")).toBeVisible();

    rerender(
      <SpinResultCard
        spin={{
          ...ecosystemSpin,
          reward: {
            kind: "ecosystem-item",
            itemId: "moon-carp",
            isDuplicate: true,
            conversionCoins: 12,
          },
        }}
        state={state}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText("重复居民：月光锦鲤")).toBeVisible();
    expect(screen.getByText("已按品质自动折算为 12 枚硬币")).toBeVisible();
  });
});

function collectibleSpin(id: string, isDuplicate = false): ResolvedSpin {
  return {
    id: `spin-${id}`,
    stage: "settled",
    reels: ["moon", "moon", "moon"],
    reward: {
      kind: "collectible",
      collectibleId: id,
      isDuplicate,
      conversionCoins: 0,
      bonusCoins: 0,
    },
    pityAfter: 0,
    createdAt: "2026-08-29T00:00:00.000Z",
  };
}
