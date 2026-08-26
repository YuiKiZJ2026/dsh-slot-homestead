import { describe, expect, it } from "vitest";
import type { CommandRequest } from "../shared/contracts";
import { InMemoryGameApi } from "./InMemoryGameApi";

describe("InMemoryGameApi", () => {
  it("keeps the standalone 1850/3000 fixture interactive through Host-shaped spin stages", async () => {
    const api = new InMemoryGameApi();
    let state = await api.getSnapshot("preview");
    expect(state.tokenEnergy.progress).toBe(1_850);
    expect(state.tokenEnergy.dailyCoins[state.localDate]).toBe(3);

    state = (await api.command(command("insertCoin", state.revision))).snapshot;
    expect(state.pendingSpin?.stage).toBe("paid");
    const spinId = state.pendingSpin!.id;

    state = (await api.command(command("pullLever", state.revision, { spinId }))).snapshot;
    expect(state.pendingSpin?.stage).toBe("spinning");

    state = (await api.command(command("settleSpin", state.revision, { spinId }))).snapshot;
    expect(state.pendingSpin).toBeNull();
    expect(state.wallet).toBeGreaterThan(7);
  });
});

function command(
  type: "insertCoin" | "pullLever" | "settleSpin",
  expectedRevision: number,
  payload: { spinId?: string } = {},
): CommandRequest {
  const base = {
    commandId: `00000000-0000-4000-8000-${String(expectedRevision + 1).padStart(12, "0")}`,
    sessionId: "preview",
    expectedRevision,
    issuedAt: "2026-08-27T00:00:00.000Z",
  };
  if (type === "insertCoin") return { ...base, type };
  return { ...base, type, spinId: payload.spinId! };
}
