import { describe, expect, it, vi } from "vitest";
import type { CommandRequest, PublicSnapshot } from "../shared/contracts";
import {
  COMMAND_PATH,
  handleCommandRequest,
  handleStateRequest,
  stateRoute,
  commandRoute,
  STATE_PATH,
} from "./http";

const snapshot: PublicSnapshot = {
  revision: 4,
  wallet: 9,
  localDate: "2026-08-26",
  lastGrantedLocalDate: "2026-08-26",
  daily: {},
  tokenEnergy: { progress: 1_850, dailyCoins: { "2026-08-26": 3 } },
  pityCount: 2,
  inventory: ["plant"],
  displaySlots: ["plant"],
  settings: { muted: true, reducedMotion: false, scale: 1 },
  pendingSpin: null,
  agentStatus: "idle",
  capabilities: { commands: true },
};

const service = {
  getSnapshot: vi.fn(async () => snapshot),
  command: vi.fn(async () => ({ status: 200 as const, snapshot })),
};

function url(path: string): string {
  return `http://127.0.0.1:4312${path}`;
}

function trustedHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    host: "127.0.0.1:4312",
    origin: "http://127.0.0.1:4312",
    "sec-fetch-site": "same-origin",
    ...extra,
  };
}

const command: CommandRequest = {
  type: "claimDaily",
  commandId: "31ed719b-a144-4b8f-aaf0-e86447f3d87c",
  sessionId: "session-1",
  expectedRevision: 4,
  issuedAt: "2026-08-26T04:00:00.000Z",
};

describe("host HTTP boundary", () => {
  it("registers only the two fixed exact route paths", () => {
    expect(stateRoute(service)).toMatchObject({ kind: "exact", path: STATE_PATH });
    expect(commandRoute(service)).toMatchObject({ kind: "exact", path: COMMAND_PATH });
    expect(STATE_PATH).toBe("/api/dsh-slot-widget/state");
    expect(COMMAND_PATH).toBe("/api/dsh-slot-widget/command");
  });

  it("returns a state projection only for GET with exactly one sessionId", async () => {
    const response = await handleStateRequest(
      new Request(url(`${STATE_PATH}?sessionId=session-1`), { headers: trustedHeaders() }),
      service,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ snapshot });

    for (const request of [
      new Request(url(STATE_PATH), { headers: trustedHeaders() }),
      new Request(url(`${STATE_PATH}?sessionId=session-1&extra=x`), { headers: trustedHeaders() }),
      new Request(url(`${STATE_PATH}/nested?sessionId=session-1`), { headers: trustedHeaders() }),
    ]) {
      const invalid = await handleStateRequest(request, service);
      expect(invalid.status).toBeGreaterThanOrEqual(400);
      expect(await invalid.json()).toHaveProperty("error.code");
    }
  });

  it("returns stable JSON when state-route request adaptation rejects malformed authority", async () => {
    let status = 0;
    let body = "";
    const response = {
      writeHead: (nextStatus: number) => { status = nextStatus; },
      end: (nextBody = "") => { body = nextBody; },
    };
    const malformedRequest = {
      method: "GET",
      url: `${STATE_PATH}?sessionId=session-1`,
      headers: { host: "[" },
      async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {},
    };

    await expect(stateRoute(service).handler(malformedRequest, response)).resolves.toBeUndefined();
    expect(status).toBe(400);
    expect(JSON.parse(body)).toEqual({ error: { code: "bad-request" } });
  });

  it("requires POST application/json and a strict command body", async () => {
    for (const [body, contentType, code] of [
      [JSON.stringify(command), "text/plain", "unsupported-media-type"],
      ["{", "application/json", "invalid-json"],
      [JSON.stringify({ ...command, unexpected: true }), "application/json", "invalid-command"],
    ] as const) {
      const response = await handleCommandRequest(new Request(url(COMMAND_PATH), {
        method: "POST",
        headers: trustedHeaders({ "content-type": contentType }),
        body,
      }), service);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.json()).toEqual({ error: { code } });
    }
  });

  it("rejects bodies larger than sixteen KiB before parsing", async () => {
    const response = await handleCommandRequest(new Request(url(COMMAND_PATH), {
      method: "POST",
      headers: trustedHeaders({ "content-type": "application/json" }),
      body: `{"padding":"${"x".repeat(16 * 1_024)}"}`,
    }), service);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: { code: "body-too-large" } });
  });

  it("accepts matching Host, Origin, and Fetch Metadata and forwards valid commands", async () => {
    const response = await handleCommandRequest(new Request(url(COMMAND_PATH), {
      method: "POST",
      headers: trustedHeaders({ "content-type": "application/json; charset=utf-8" }),
      body: JSON.stringify(command),
    }), service);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ snapshot });
  });

  it.each([
    { host: "evil.example", origin: "http://evil.example", "sec-fetch-site": "same-origin" },
    { host: "127.0.0.1:4312", origin: "http://evil.example", "sec-fetch-site": "cross-site" },
  ])("rejects untrusted Host/Origin/Fetch Metadata", async (headers) => {
    const response = await handleStateRequest(
      new Request(url(`${STATE_PATH}?sessionId=session-1`), { headers }),
      service,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "forbidden" } });
  });

  it("maps service failures to stable JSON without reflecting the request body", async () => {
    const secret = "never-log-or-reflect-this";
    const failing = {
      ...service,
      command: vi.fn(async () => { throw new Error(secret); }),
    };
    const response = await handleCommandRequest(new Request(url(COMMAND_PATH), {
      method: "POST",
      headers: trustedHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(command),
    }), failing);
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toBe(JSON.stringify({ error: { code: "storage-error" } }));
    expect(serialized).not.toContain(secret);
  });
});
