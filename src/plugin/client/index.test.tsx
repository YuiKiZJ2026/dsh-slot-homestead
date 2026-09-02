import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialEcosystemState } from "../../domain/types";
import type { PublicSnapshot } from "../shared/contracts";
import { apply, inject } from "./index";
import { PLUGIN_STYLE } from "./style";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.querySelectorAll("style[data-dsh-slot-widget]").forEach((node) => node.remove());
});

describe("DSH shell companion", () => {
  it("lets transparent overlay regions pass clicks through while keeping controls interactive", () => {
    expect(PLUGIN_STYLE).toMatch(
      /\.dsh-slot-widget-root\.desktop--overlay\s*\{[^}]*pointer-events:\s*none;/,
    );
    expect(PLUGIN_STYLE).toMatch(
      /\.dsh-slot-widget-root\.desktop--overlay \.slot-widget canvas\s*\{[^}]*pointer-events:\s*none;/,
    );
    for (const selector of ["\\.widget-launchers \\.pixel-button", "\\.utility-panel", "\\.scene-control"]) {
      expect(PLUGIN_STYLE).toMatch(new RegExp(
        `\\.dsh-slot-widget-root\\.desktop--overlay ${selector}\\s*\\{[^}]*pointer-events:\\s*auto;`,
      ));
    }
  });

  it("registers the official root overlay and renders without an active conversation", async () => {
    let View: ComponentType | null = null;
    const register = vi.fn((definition, component) => {
      expect(definition).toEqual({
        name: "shell.overlay",
        id: "dsh-slot-widget",
        order: 20,
      });
      View = component;
      return () => undefined;
    });
    const slotInject = vi.fn((name, factory) => {
      expect(name).toBe("shell.overlay");
      return factory();
    });
    apply({ slots: { inject: slotInject, register } });
    expect(inject).toEqual(["slots"]);
    expect(View).not.toBeNull();

    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const address = String(input);
      return new Response(JSON.stringify(address.includes("/companion")
        ? { status: "unavailable" }
        : { snapshot: snapshot() }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const { unmount } = render(createElement(View!));

    await screen.findByRole("application", { name: "DSH 桌面老虎机" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      "/api/dsh-slot-widget/state?sessionId=dsh-slot-widget-global",
      expect.objectContaining({ method: "GET" }),
    ));
    expect(screen.getByRole("application", { name: "DSH 桌面老虎机" })).toHaveClass("desktop--overlay");
    expect(document.head.querySelector("style[data-dsh-slot-widget]")).not.toBeNull();

    unmount();
    expect(document.head.querySelector("style[data-dsh-slot-widget]")).toBeNull();
  });
});

function snapshot(): PublicSnapshot {
  return {
    revision: 1,
    wallet: 5,
    localDate: "2026-08-27",
    lastGrantedLocalDate: "2026-08-27",
    daily: { "2026-08-27": { workCoins: 3 } },
    tokenEnergy: { progress: 1_850, dailyCoins: { "2026-08-27": 3 } },
    pityCount: 0,
    inventory: [],
    displaySlots: [],
    settings: { muted: true, reducedMotion: true, scale: 1 },
    pendingSpin: null,
    agentStatus: "idle",
    capabilities: { commands: true },
    ecosystem: createInitialEcosystemState(),
  };
}
