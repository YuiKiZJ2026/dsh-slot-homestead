import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DshAdapter } from "../dsh/adapter";
import { STATE_KEY, StateRepository } from "../storage/repository";
import { FixedClock } from "../time/clock";
import { App, type AppRuntime } from "./App";

const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks");

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("Image", class LoadedImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext());
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalLocksDescriptor === undefined) {
    Reflect.deleteProperty(navigator, "locks");
  } else {
    Object.defineProperty(navigator, "locks", originalLocksDescriptor);
  }
});

describe("App", () => {
  it("composes the wallet, permanent launchers, and accessible pixel canvas", async () => {
    render(<App />);

    expect(
      screen.getByRole("application", { name: "DSH 桌面老虎机" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
    expect(screen.getByText(/钱包/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开演示控制台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开收藏柜" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开商店" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开设置" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "DSH 像素老虎机场景" })).toHaveTextContent(
      "DSH 像素老虎机场景",
    );

    await userEvent.click(screen.getByRole("button", { name: "打开收藏柜" }));
    await userEvent.click(screen.getByRole("button", { name: "关闭收藏柜" }));
    expect(screen.getByRole("button", { name: "打开收藏柜" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "收藏柜" })).not.toBeInTheDocument();
  });

  it("routes the development result selector to the next paid spin", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (
          _name: string,
          _options: { mode: "exclusive"; ifAvailable: true },
          callback: (lock: object | null) => Promise<void> | void,
        ) => callback({}),
      },
    });
    render(<App />);

    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("3"));
    await userEvent.click(screen.getByRole("button", { name: "打开演示控制台" }));
    await userEvent.selectOptions(screen.getByLabelText("预设下次结果"), "common");
    const coin = screen.getByRole("button", { name: "投入 1 枚硬币" });
    await waitFor(() => expect(coin).toBeEnabled());
    await userEvent.click(coin);

    const rawState = localStorage.getItem(STATE_KEY);
    expect(rawState).not.toBeNull();
    expect(JSON.parse(rawState!)).toMatchObject({
      wallet: 2,
      activeSpin: {
        reels: ["leaf", "leaf", "leaf"],
        reward: { kind: "collectible", collectibleId: "plant" },
      },
    });
  });

  it("composes the core app with a subscribe-only DSH adapter", () => {
    const subscribe = vi.fn<DshAdapter["subscribe"]>(() => () => undefined);
    const adapter: DshAdapter = { subscribe };
    const runtime = {
      repository: new StateRepository(localStorage),
      clock: new FixedClock(new Date("2026-08-26T08:00:00.000Z")),
      adapter,
      createId: () => "real-adapter-spin",
    } satisfies AppRuntime;

    render(<App createRuntime={() => runtime} />);

    expect(subscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole("application", { name: "DSH 桌面老虎机" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开演示控制台" })).not.toBeInTheDocument();
  });

  it("holds one asynchronous writer lease and releases it during cleanup", async () => {
    let released = false;
    const request = vi.fn(async (
      _name: string,
      _options: { mode: "exclusive"; ifAvailable: true },
      callback: (lock: object | null) => Promise<void> | void,
    ) => {
      await callback({});
      released = true;
    });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });

    const { unmount, rerender } = render(<StrictMode><App /></StrictMode>);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "投入 1 枚硬币" })).toBeEnabled();
    });

    rerender(<StrictMode><App /></StrictMode>);
    expect(request).toHaveBeenCalledOnce();
    unmount();

    await waitFor(() => expect(released).toBe(true));
  });
});

function canvasContext(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D;
}
