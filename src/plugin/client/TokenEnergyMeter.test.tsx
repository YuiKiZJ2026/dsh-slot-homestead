import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TokenEnergyMeter } from "./TokenEnergyMeter";

afterEach(cleanup);

describe("TokenEnergyMeter", () => {
  it("announces Host-provided progress and today's reward cap accessibly", () => {
    render(<TokenEnergyMeter progress={1_850} dailyCoins={3} />);

    expect(screen.getByText("Token 能量：1,850 / 3,000")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1850");
    expect(screen.getByText("今日 Token 奖励：3 / 8")).toBeVisible();
  });
});
