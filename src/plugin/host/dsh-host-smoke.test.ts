import type { Context } from "@deepseek-ai/cordis";
import { describe, expect, it, vi } from "vitest";
import { createInitialHostState, type GameDomain } from "./domain";
import {
  COMMAND_PATH,
  COMPANION_PATH,
  COMPANION_SCRIPT_PATH,
  COMPANION_WINDOW_PATH,
  STATE_PATH,
  type HostWebRoute,
} from "./http";
import { apply, gameDomainSpec } from "./index";

describe("DSH Host fake-Context composition (not a real DSH install)", () => {
  it("keeps the storage-domain version stable so its schema can read and migrate v1 values", () => {
    expect(gameDomainSpec).toMatchObject({ name: "dsh_slot_widget", version: 1 });
  });

  it("registers exact routes and listeners, then disposes them in reverse order before closing", async () => {
    const disposalOrder: string[] = [];
    const registeredEvents: string[] = [];
    const registeredRoutes: HostWebRoute[] = [];
    let effectDisposer: (() => void | Promise<void>) | undefined;
    const domain: GameDomain = {
      global: {
        get: () => createInitialHostState(),
        set: vi.fn(async () => undefined),
      },
      close: vi.fn(async () => {
        disposalOrder.push("domain:close");
      }),
    };
    const open = vi.fn(async () => domain);
    const list = vi.fn(() => []);
    const context = {
      storageDomain: { open },
      sessions: { list },
      webServer: {
        port: 43120,
        register: vi.fn((route: HostWebRoute) => {
          registeredRoutes.push(route);
          return () => {
            disposalOrder.push(`route:${route.path}`);
          };
        }),
      },
      logger: { error: vi.fn() },
      on: vi.fn((event: string) => {
        registeredEvents.push(event);
        return () => {
          disposalOrder.push(`listener:${event}`);
        };
      }),
      effect: vi.fn((setup: () => void | (() => void | Promise<void>)) => {
        effectDisposer = setup() ?? undefined;
      }),
    };

    await apply(context as unknown as Context);

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(gameDomainSpec);
    expect(list).toHaveBeenCalledOnce();
    expect(registeredEvents).toEqual(["session/event", "agent/status"]);
    expect(registeredRoutes.map(({ kind, path }) => ({ kind, path }))).toEqual([
      { kind: "exact", path: STATE_PATH },
      { kind: "exact", path: COMMAND_PATH },
      { kind: "exact", path: COMPANION_PATH },
      { kind: "exact", path: COMPANION_WINDOW_PATH },
      { kind: "exact", path: COMPANION_SCRIPT_PATH },
    ]);

    expect(effectDisposer).toBeTypeOf("function");
    await effectDisposer?.();

    expect(disposalOrder).toEqual([
      `route:${COMPANION_SCRIPT_PATH}`,
      `route:${COMPANION_WINDOW_PATH}`,
      `route:${COMPANION_PATH}`,
      `route:${COMMAND_PATH}`,
      `route:${STATE_PATH}`,
      "listener:agent/status",
      "listener:session/event",
      "domain:close",
    ]);
  });
});
