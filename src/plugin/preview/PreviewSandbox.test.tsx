import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PreviewSandboxControls } from "./PreviewSandbox";

describe("PreviewSandboxControls", () => {
  it("offers preview-only refill and reset actions with an announced status", async () => {
    const user = userEvent.setup();
    const onRefill = vi.fn();
    const onAdvanceEcosystem = vi.fn();
    const onReset = vi.fn();
    render(
      <PreviewSandboxControls
        status="测试资源已补满"
        onRefill={onRefill}
        onAdvanceEcosystem={onAdvanceEcosystem}
        onReset={onReset}
      />,
    );

    expect(screen.getByRole("region", { name: "预览测试沙盒" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("测试资源已补满");
    await user.click(screen.getByRole("button", { name: "补满测试资源" }));
    await user.click(screen.getByRole("button", { name: "生态快进 6 小时" }));
    await user.click(screen.getByRole("button", { name: "重置测试沙盒" }));
    expect(onRefill).toHaveBeenCalledTimes(1);
    expect(onAdvanceEcosystem).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
