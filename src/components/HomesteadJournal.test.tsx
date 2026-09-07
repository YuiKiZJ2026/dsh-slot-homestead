import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "../domain/types";
import { recordJournalCare } from "../ecosystem/journal";
import { HomesteadJournal } from "./HomesteadJournal";

afterEach(cleanup);

describe("庄园手账界面", () => {
  it("lets an existing next crop be cancelled without hiding the current crop", async () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.plots["1"].growth = 40;
    state.ecosystem.lifecycle.plots["1"].nextSeedId = "tomato-seed";
    const cancel = vi.fn();
    render(<HomesteadJournal open initialChapter="garden" state={state} date="2026-09-07" disabled={false} error={null} onClose={vi.fn()} onClaim={vi.fn()} onPlant={vi.fn()} onCancelPlanting={cancel} />);
    expect(screen.getByText("下一茬：番茄")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "撤销田地1下一茬" }));
    expect(cancel).toHaveBeenCalledWith("1");
    expect(screen.getByRole("progressbar", { name: "田地1成长" })).toHaveAttribute("value", "40");
  });

  it("harvests ready crops directly from the planting planner and shows their pictures", async () => {
    const state = createInitialState();
    state.ecosystem.lifecycle.plots["1"].growth = 100;
    state.ecosystem.lifecycle.plots["1"].readyYield = 2;
    const harvest = vi.fn();
    render(<HomesteadJournal open initialChapter="garden" state={state} date="2026-09-07" disabled={false} error={null} onClose={vi.fn()} onClaim={vi.fn()} onPlant={vi.fn()} onHarvest={harvest} />);
    await userEvent.click(screen.getByRole("button", { name: "收获菜园成熟作物" }));
    expect(harvest).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("田地1作物预览")).toBeVisible();
  });

  it("reveals only on demand and wires earned rewards", async () => {
    const state = createInitialState();
    state.ecosystem = recordJournalCare(state.ecosystem, "aquarium", new Date("2026-09-05T12:00:00"));
    const claim = vi.fn();
    const props = { state, date: "2026-09-05", disabled: false, error: null, onClose: vi.fn(), onClaim: claim, onPlant: vi.fn() };
    const { rerender } = render(<HomesteadJournal {...props} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<HomesteadJournal {...props} open />);
    await userEvent.click(screen.getByRole("button", { name: "领取给小邻居的早餐" }));
    expect(claim).toHaveBeenCalledWith("daily-care");
    expect(screen.getByRole("button", { name: "领取庄园巡游" })).toBeDisabled();
  });
  it("opens planting directly, disables unavailable actions, and selects a plot", async () => {
    const plant = vi.fn();
    render(<HomesteadJournal open initialChapter="garden" state={createInitialState()} date="2026-09-05" disabled={false} error={null} onClose={() => undefined} onClaim={() => undefined} onPlant={plant} />);
    expect(screen.getByRole("button", { name: "播种田地1" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "播种田地2" }));
    expect(plant).toHaveBeenCalledWith("2", "carrot-seed");
  });
});
