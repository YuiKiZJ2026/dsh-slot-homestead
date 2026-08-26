import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";

afterEach(cleanup);

function setViewport(width: number, height: number): void {
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: width },
    innerHeight: { configurable: true, value: height },
  });
  fireEvent(window, new Event("resize"));
}

describe("SettingsPanel", () => {
  it("updates mute, reduced motion, and integer scale settings", async () => {
    setViewport(1600, 1000);
    const onChange = vi.fn();
    render(
      <SettingsPanel
        open
        settings={{ muted: true, reducedMotion: false, scale: 1 }}
        onClose={() => undefined}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "静音" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "减少动态效果" }));
    await userEvent.click(screen.getByRole("button", { name: "2 倍" }));

    expect(onChange.mock.calls).toEqual([
      [{ muted: false }],
      [{ reducedMotion: true }],
      [{ scale: 2 }],
    ]);
  });

  it("hides 2x when the full miniature would exceed its desktop target area", () => {
    setViewport(1440, 900);
    const props: React.ComponentProps<typeof SettingsPanel> = {
      open: true,
      settings: { muted: true, reducedMotion: false, scale: 1 },
      onClose: () => undefined,
      onChange: () => undefined,
    };
    const { rerender } = render(
      <SettingsPanel
        {...props}
      />,
    );
    expect(screen.queryByRole("button", { name: "2 倍" })).not.toBeInTheDocument();

    setViewport(1600, 1000);
    rerender(<SettingsPanel {...props} />);
    expect(screen.getByRole("button", { name: "2 倍" })).toBeInTheDocument();
  });
});
