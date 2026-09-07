import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { HomesteadFeedback, describeHomesteadChange } from "./HomesteadFeedback";

afterEach(() => vi.useRealTimers());

describe("confirmed homestead feedback", () => {
  it("announces confirmed merchant purchases and sales, not a visit alone", () => {
    const before=createInitialState(); before.wallet=10;
    const after=structuredClone(before);
    after.ecosystem.merchant={visitId:"merchant-42-2",purchased:{"fish-feed":1},soldCount:0};
    after.wallet=6;
    expect(describeHomesteadChange(before,after)).toMatchObject({kind:"trade",title:"商人交易完成",detail:"购入 1 件货品 · 钱包净变化 −4"});
    const sold=structuredClone(after);sold.ecosystem.merchant!.soldCount=2;sold.wallet=14;
    expect(describeHomesteadChange(after,sold)).toMatchObject({kind:"trade",detail:"出售 2 份收成 · 钱包净变化 +8"});
    expect(describeHomesteadChange(after,structuredClone(after))).toBeNull();
  });
  it("does not announce initial data or unchanged polling snapshots", () => {
    const state = createInitialState();
    const { rerender } = render(<HomesteadFeedback state={state} ready={false} />);
    rerender(<HomesteadFeedback state={state} ready />);
    expect(screen.queryByTestId("homestead-feedback")).not.toBeInTheDocument();
    expect(describeHomesteadChange(state, structuredClone(state))).toBeNull();
  });

  it("does not mislabel a resource reset or a rolled-back snapshot as care", () => {
    const before = createInitialState();
    before.ecosystem.supplies.fishFeed = 10;
    const after = structuredClone(before);
    after.ecosystem.supplies.fishFeed = 9;
    after.wallet = 99;
    expect(describeHomesteadChange(before, after)).toBeNull();
    before.revision = 10;
    after.revision = 0;
    after.ecosystem.lifecycle.plots["1"].readyYield = 2;
    expect(describeHomesteadChange(before, after)).toBeNull();
  });

  it("announces actual harvest counts and actual coins rather than click intent", () => {
    const before = createInitialState();
    const after = structuredClone(before);
    after.ecosystem.lifecycle.produce.carrot = 3;
    after.wallet = 9;
    expect(describeHomesteadChange(before, after)).toEqual({ kind: "harvest", title: "收获已入账", detail: "3 份产物 · 钱包净变化 +9" });
    expect(describeHomesteadChange(before, before)).toBeNull();
  });

  it("labels combined harvest and spending snapshots as net wallet change", () => {
    const before = createInitialState();
    const after = structuredClone(before);
    after.ecosystem.lifecycle.produce.carrot = 1;
    after.ecosystem.supplies.fishFeed++;
    after.wallet = 1;
    expect(describeHomesteadChange(before, after)?.detail).toBe("1 份产物 · 钱包净变化 +1");
    after.ecosystem.lifecycle.produce = {};
    before.wallet = 2;
    after.wallet = 1;
    expect(describeHomesteadChange(before, after)?.detail).toBe("钱包净变化 −1 · 补给数量已更新");
  });

  it("reports a cancelled plan from the confirmed fertilizer balance", () => {
    const before = createInitialState();
    before.ecosystem.lifecycle.plots["1"].nextSeedId = "tomato-seed";
    const after = structuredClone(before);
    delete after.ecosystem.lifecycle.plots["1"].nextSeedId;
    after.ecosystem.supplies.fertilizer += 1;
    expect(describeHomesteadChange(before, after)).toMatchObject({ kind: "plant", title: "下一茬计划已撤销", detail: "肥料 +1 · 当前作物继续生长" });
  });

  it("summarizes mature crops once and prioritizes rewards over supply changes", () => {
    const before = createInitialState();
    const mature = structuredClone(before);
    mature.ecosystem.lifecycle.plots["1"].readyYield = 1;
    mature.ecosystem.lifecycle.plots["1"].growth = 100;
    expect(describeHomesteadChange(before, mature)).toMatchObject({ kind: "growth", title: "菜园有新收成" });
    const rewarded = structuredClone(before);
    rewarded.ecosystem.journal = { day: "2026-09-07", care: [], harvests: 0, dailyClaimed: ["daily-care"], milestonesClaimed: [], xp: 10 };
    rewarded.ecosystem.supplies.fishFeed++;
    expect(describeHomesteadChange(before, rewarded)).toMatchObject({ kind: "reward", title: "手账奖励已收下" });
  });

  it("clears timed feedback and keeps reduced-motion content readable", () => {
    vi.useFakeTimers();
    const before = createInitialState();
    const { rerender } = render(<HomesteadFeedback state={before} ready />);
    const after = structuredClone(before);
    after.ecosystem.supplies.fishFeed--;
    after.ecosystem.lifecycle.fish.goldfish.boostedUntil = "2026-09-07T16:00:00Z";
    after.settings.reducedMotion = true;
    rerender(<HomesteadFeedback state={after} ready />);
    expect(screen.getByTestId("homestead-feedback")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("homestead-feedback")).toHaveTextContent("鱼食已投下");
    act(() => vi.advanceTimersByTime(4200));
    expect(screen.queryByTestId("homestead-feedback")).not.toBeInTheDocument();
  });
});
