import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandRequest, PublicSnapshot } from "../shared/contracts";
import { HttpGameApi } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HttpGameApi", () => {
  it("preserves the Window receiver when it uses the native global fetch", async () => {
    const nativeLikeFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse({ snapshot: snapshot() }));
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", nativeLikeFetch);

    await expect(new HttpGameApi().getSnapshot("global-widget")).resolves.toEqual(snapshot());
    expect(nativeLikeFetch).toHaveBeenCalledOnce();
  });

  it("encodes the session id and strictly parses the state envelope", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      snapshot: snapshot(),
    }));
    const api = new HttpGameApi(fetcher);

    await expect(api.getSnapshot("session A/?")).resolves.toEqual(snapshot());
    expect(fetcher).toHaveBeenCalledWith(
      "/api/dsh-slot-widget/state?sessionId=session+A%2F%3F",
      expect.objectContaining({ method: "GET" }),
    );

    fetcher.mockResolvedValueOnce(jsonResponse({
      snapshot: { ...snapshot(), unexpected: true },
    }));
    await expect(api.getSnapshot("session-1")).rejects.toThrow();
  });

  it("targets the loopback Host API when used by the standalone desktop companion", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ snapshot: snapshot() }));
    const api = new HttpGameApi(fetcher, "http://127.0.0.1:43120/");

    await api.getSnapshot("desktop-companion");
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:43120/api/dsh-slot-widget/state?sessionId=desktop-companion",
      expect.any(Object),
    );
  });

  it("posts a strict command and returns the authoritative success snapshot", async () => {
    const request = insertRequest();
    const next = snapshot({ revision: 8, wallet: 4 });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ snapshot: next }));

    const result = await new HttpGameApi(fetcher).command(request);

    expect(result).toEqual({ status: 200, snapshot: next });
    expect(fetcher).toHaveBeenCalledWith("/api/dsh-slot-widget/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: undefined,
    });
  });

  it("uses the server snapshot returned with a 409 instead of discarding it", async () => {
    const current = snapshot({ revision: 12, wallet: 2 });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      snapshot: current,
      errorCode: "revision-conflict",
    }, 409));

    await expect(new HttpGameApi(fetcher).command(insertRequest())).resolves.toEqual({
      status: 409,
      snapshot: current,
      errorCode: "revision-conflict",
    });
  });
});

function snapshot(overrides: Partial<PublicSnapshot> = {}): PublicSnapshot {
  return {
    revision: 7,
    wallet: 5,
    localDate: "2026-08-27",
    lastGrantedLocalDate: "2026-08-27",
    daily: { "2026-08-27": { workCoins: 3 } },
    tokenEnergy: { progress: 1_850, dailyCoins: { "2026-08-27": 3 } },
    pityCount: 1,
    inventory: ["plant"],
    displaySlots: ["plant"],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    agentStatus: "idle",
    capabilities: { commands: true },
    ...overrides,
  };
}

function insertRequest(): CommandRequest {
  return {
    type: "insertCoin",
    commandId: "00000000-0000-4000-8000-000000000001",
    sessionId: "session-1",
    expectedRevision: 7,
    issuedAt: "2026-08-27T00:00:00.000Z",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
