import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TokenEnergyMeter } from "./TokenEnergyMeter";

afterEach(cleanup);

describe("TokenEnergyMeter", () => {
  it("announces Host-provided progress and today's reward cap accessibly", () => {
    render(<TokenEnergyMeter progress={6_346} dailyCoins={3} />);

    expect(screen.getByText("实际 Token：6,346 / 10,000")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "实际 Token 进度" }))
      .toHaveAttribute("aria-valuenow", "6346");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "10000");
    expect(screen.getByText("今日 Token 奖励：3 / 8")).toBeVisible();
  });
});
