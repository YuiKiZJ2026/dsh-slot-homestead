import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createInitialState } from "../domain/types";
import { WorldClock } from "./WorldClock";
import { getMerchantView } from "../ecosystem/merchant";
afterEach(cleanup);
describe("庄园时钟入口", () => {
  it("marks a real merchant visit on the compact clock", () => {
    const ecosystem=createInitialState().ecosystem;
    ecosystem.world={elapsedMs:0,lastRealAt:"2026-09-07T00:00:00.000Z",seed:42};
    const arrival=getMerchantView(ecosystem).nextArrivalDay;
    ecosystem.world.elapsedMs=((arrival-1)*24+2)*3600000;
    render(<WorldClock ecosystem={ecosystem} open={false} onOpen={vi.fn()}/>);
    expect(screen.getByRole("button",{name:/旅行商人来访/})).toHaveAttribute("data-merchant-present","true");
    expect(screen.getByText("商人来访")).toBeVisible();
  });
  it("shows the installation day and reveals the exact time conversion", () => {
    render(<WorldClock ecosystem={createInitialState().ecosystem} open={false} onOpen={vi.fn()} />);
    expect(screen.getByRole("button", {name:/第 1 天.*06:00/})).toBeVisible();
    expect(screen.getByText("06:00")).toBeVisible();
  });
  it("shows an independent game day and opens the calendar", () => {
    const ecosystem = createInitialState().ecosystem;
    ecosystem.world = {elapsedMs: 24*3600000, lastRealAt:"2026-09-07T00:00:00.000Z", seed:42};
    const open = vi.fn();
    render(<WorldClock ecosystem={ecosystem} open={true} onOpen={open} />);
    fireEvent.click(screen.getByRole("button", {name:/第 2 天/}));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", {name:/第 2 天/})).toHaveAttribute("aria-expanded", "true");
  });
});
