import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DshEvent } from "../dsh/events";
import type { OutcomeKind } from "../game/outcomes";
import { DemoPanel } from "./DemoPanel";

afterEach(cleanup);

function renderPanel(overrides: Partial<React.ComponentProps<typeof DemoPanel>> = {}) {
  const props: React.ComponentProps<typeof DemoPanel> = {
    open: true,
    onClose: vi.fn(),
    onCompleteTask: () => "task-1",
    onVerifyTask: vi.fn(),
    onAddFocusHour: vi.fn(),
    onSetStatus: vi.fn(),
    onAdvanceDay: vi.fn(),
    onReset: vi.fn(),
    stateSummary: "3 枚",
    dailyWorkCoins: 4,
    focusCoins: 2,
    focusMinutes: 75,
    pityMisses: 6,
    lastEvent: {
      id: "event-1",
      type: "focus.minutes",
      occurredAt: "2026-08-26T08:00:00.000Z",
      minutes: 60,
    } satisfies DshEvent,
    mode: "writer",
    ...overrides,
  };
  return { ...render(<DemoPanel {...props} />), props };
}

describe("DemoPanel", () => {
  it("renders every demo action with its exact accessible name", () => {
    renderPanel();

    for (const name of [
      "完成一个任务",
      "验证最近任务",
      "增加 60 分钟有效专注",
      "状态：空闲",
      "状态：工作中",
      "状态：完成",
      "状态：报错",
      "进入下一天",
      "重置原型存档",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("emits one sixty-minute focus action", async () => {
    const onAddFocusHour = vi.fn();
    renderPanel({ onAddFocusHour });

    await userEvent.click(screen.getByRole("button", { name: "增加 60 分钟有效专注" }));

    expect(onAddFocusHour).toHaveBeenCalledOnce();
  });

  it("offers every one-shot result preset and resets to automatic after selection", async () => {
    const onPresetNextOutcome = vi.fn<(outcome: OutcomeKind) => void>();
    renderPanel({ onPresetNextOutcome });
    const selector = screen.getByLabelText("预设下次结果");

    expect(
      [...selector.querySelectorAll("option")].map(({ value }) => value),
    ).toEqual([
      "auto",
      "none",
      "refund",
      "five-coins",
      "common",
      "rare",
      "set",
      "robot-jackpot",
    ]);

    await userEvent.selectOptions(selector, "common");

    expect(onPresetNextOutcome).toHaveBeenCalledOnce();
    expect(onPresetNextOutcome).toHaveBeenCalledWith("common");
    expect(selector).toHaveValue("auto");
  });

  it("keeps automatic selection free of an outcome preset", async () => {
    const onPresetNextOutcome = vi.fn<(outcome: OutcomeKind) => void>();
    renderPanel({ onPresetNextOutcome });

    await userEvent.selectOptions(screen.getByLabelText("预设下次结果"), "auto");

    expect(onPresetNextOutcome).not.toHaveBeenCalled();
  });

  it("omits the result preset when the development callback is unavailable", () => {
    renderPanel({ onPresetNextOutcome: undefined });

    expect(screen.queryByLabelText("预设下次结果")).not.toBeInTheDocument();
  });

  it("verifies the most recently completed task", async () => {
    const onVerifyTask = vi.fn();
    renderPanel({ onCompleteTask: () => "task-latest", onVerifyTask });

    expect(screen.getByRole("button", { name: "验证最近任务" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "完成一个任务" }));
    await userEvent.click(screen.getByRole("button", { name: "验证最近任务" }));

    expect(onVerifyTask).toHaveBeenCalledOnce();
    expect(onVerifyTask).toHaveBeenCalledWith("task-latest");
  });

  it("advances the demo day once", async () => {
    const onAdvanceDay = vi.fn();
    renderPanel({ onAdvanceDay });

    await userEvent.click(screen.getByRole("button", { name: "进入下一天" }));

    expect(onAdvanceDay).toHaveBeenCalledOnce();
  });

  it("requires a second confirmation before resetting", async () => {
    const onReset = vi.fn();
    renderPanel({ onReset });

    await userEvent.click(screen.getByRole("button", { name: "重置原型存档" }));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "确认重置原型存档" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "确认重置原型存档" }));

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog", { name: "确认重置原型存档" })).not.toBeInTheDocument();
  });

  it("forgets the latest task after a confirmed reset", async () => {
    renderPanel({ onCompleteTask: () => "task-before-reset" });
    await userEvent.click(screen.getByRole("button", { name: "完成一个任务" }));
    expect(screen.getByRole("button", { name: "验证最近任务" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "重置原型存档" }));
    await userEvent.click(screen.getByRole("button", { name: "确认重置原型存档" }));

    expect(screen.getByRole("button", { name: "验证最近任务" })).toBeDisabled();
  });

  it("isolates background controls and keeps keyboard focus inside reset confirmation", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "重置原型存档" }));

    const confirm = screen.getByRole("button", { name: "确认重置原型存档" });
    const cancel = screen.getByRole("button", { name: "取消" });
    const complete = screen.getByText("完成一个任务").closest("button");
    expect(confirm).toHaveFocus();
    expect(complete).toBeDisabled();
    expect(complete?.closest("[aria-hidden='true']")).toHaveAttribute("inert");

    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
  });

  it("cancels reset with Escape and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    renderPanel();
    const reset = screen.getByRole("button", { name: "重置原型存档" });
    await user.click(reset);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog", { name: "确认重置原型存档" })).not.toBeInTheDocument();
    expect(reset).toHaveFocus();
  });

  it("clears reset confirmation while closed before reopening", async () => {
    const { rerender, props } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "重置原型存档" }));
    expect(screen.getByRole("alertdialog", { name: "确认重置原型存档" })).toBeInTheDocument();

    rerender(<DemoPanel {...props} open={false} />);
    rerender(<DemoPanel {...props} open />);

    expect(screen.queryByRole("alertdialog", { name: "确认重置原型存档" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置原型存档" })).toBeEnabled();
  });

  it("shows economy, last-event, pity, and mode diagnostics", () => {
    renderPanel();

    expect(screen.getByText("钱包：3 枚")).toBeInTheDocument();
    expect(screen.getByText("每日工作币：4 / 25")).toBeInTheDocument();
    expect(screen.getByText("专注奖励币：2 / 16")).toBeInTheDocument();
    expect(screen.getByText("有效专注：75 分钟")).toBeInTheDocument();
    expect(screen.getByText("保底未命中：6")).toBeInTheDocument();
    expect(screen.getByText("最后事件：focus.minutes · event-1")).toBeInTheDocument();
    expect(screen.getByText("写入模式：writer")).toBeInTheDocument();
  });

  it("renders nothing while collapsed", () => {
    renderPanel({ open: false });

    expect(screen.queryByRole("dialog", { name: "DSH 演示控制台" })).not.toBeInTheDocument();
  });
});
