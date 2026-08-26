import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicSnapshot } from "../shared/contracts";
import { apply, inject } from "./index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.querySelectorAll("style[data-dsh-slot-widget]").forEach((node) => node.remove());
});

describe("DSH conversation view", () => {
  it("registers the official slot, reads its sessionId prop, and removes materialized styles", async () => {
    let View: ComponentType<{ sessionId: string }> | null = null;
    const register = vi.fn((definition, component) => {
      expect(definition).toEqual({
        name: "conversation.view",
        id: "dsh-slot-widget",
        label: "老虎机",
        order: 20,
      });
      View = component;
      return () => undefined;
    });
    const slotInject = vi.fn((name, factory) => {
      expect(name).toBe("conversation.view");
      return factory();
    });
    apply({ slots: { inject: slotInject, register } });
    expect(inject).toEqual(["slots"]);
    expect(View).not.toBeNull();

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      snapshot: snapshot(),
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    const { unmount } = render(createElement(View!, { sessionId: "session from props/?" }));

    await screen.findByRole("application", { name: "DSH 桌面老虎机" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      "/api/dsh-slot-widget/state?sessionId=session+from+props%2F%3F",
      expect.objectContaining({ method: "GET" }),
    ));
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
  };
}
