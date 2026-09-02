import { describe, expect, it, vi } from "vitest";
import { createInitialEcosystemState } from "../../domain/types";
import type { PublicSnapshot } from "../shared/contracts";
import { startCompanionServer } from "./companion-server";

const snapshot: PublicSnapshot = {
  revision: 59,
  wallet: 2,
  localDate: "2026-08-27",
  lastGrantedLocalDate: "2026-08-27",
  daily: {},
  tokenEnergy: { progress: 6_346, dailyCoins: {} },
  pityCount: 0,
  inventory: ["book-stand", "desk-clock"],
  displaySlots: [],
  tablePlacements: [],
  settings: { muted: true, reducedMotion: false, scale: 1 },
  pendingSpin: null,
  agentStatus: "idle",
  capabilities: { commands: true },
  ecosystem: createInitialEcosystemState(),
};

describe("loopback companion server", () => {
  it("serves one capability-scoped page, bundle, and authoritative API until closed", async () => {
    const server = await startCompanionServer({
      getSnapshot: vi.fn(async () => snapshot),
      command: vi.fn(async () => ({ status: 200 as const, snapshot })),
    }, () => "window.__slotLoaded = true", () => "fixed-capability-token");

    try {
      expect(server.apiBase).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/fixed-capability-token$/);
      expect(server.pageUrl).toBe(`${server.apiBase}/window?apiBase=${encodeURIComponent(server.apiBase)}`);

      const page = await fetch(server.pageUrl);
      expect(page.status).toBe(200);
      expect(page.headers.get("content-security-policy")).toContain("connect-src 'self'");
      const pageHtml = await page.text();
      expect(pageHtml).toContain("./companion.js");
      expect(pageHtml).toContain("html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}");
      expect(await (await fetch(`${server.apiBase}/companion.js`)).text())
        .toBe("window.__slotLoaded = true");

      const state = await fetch(
        `${server.apiBase}/api/dsh-slot-widget/state?sessionId=dsh-slot-widget-global`,
      );
      expect(state.status).toBe(200);
      expect(await state.json()).toEqual({ snapshot });

      const command = await fetch(`${server.apiBase}/api/dsh-slot-widget/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "claimDaily",
          commandId: "31ed719b-a144-4b8f-aaf0-e86447f3d87c",
          sessionId: "dsh-slot-widget-global",
          expectedRevision: 59,
          issuedAt: "2026-08-27T04:00:00.000Z",
        }),
      });
      expect(command.status).toBe(200);
      expect(await command.json()).toEqual({ snapshot });

      expect((await fetch(server.pageUrl, { method: "DELETE" })).status).toBe(405);

      const wrongCapability = await fetch(
        `${new URL(server.apiBase).origin}/wrong/api/dsh-slot-widget/state?sessionId=x`,
      );
      expect(wrongCapability.status).toBe(404);
    } finally {
      await server.close();
    }
    await expect(fetch(server.pageUrl)).rejects.toThrow();
  });

  it("rejects short or non-URL-safe capability values before binding", async () => {
    await expect(startCompanionServer({
      getSnapshot: vi.fn(async () => snapshot),
      command: vi.fn(async () => ({ status: 200 as const, snapshot })),
    }, () => "", () => "short"))
      .rejects.toThrow(/capability/i);
  });
});
