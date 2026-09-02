import { describe, expect, it } from "vitest";
import type { CommandRequest } from "../shared/contracts";
import { InMemoryGameApi } from "./InMemoryGameApi";

describe("InMemoryGameApi", () => {
  it("refills exhausted preview supplies, clears an unfinished spin, and keeps each page sandbox isolated", async () => {
    const firstPageApi = new InMemoryGameApi();
    const secondPageApi = new InMemoryGameApi();
    let firstPage = await firstPageApi.getSnapshot("preview-first");

    firstPage = (await firstPageApi.command({
      ...base(firstPage.revision, 1),
      type: "careHabitat",
      habitat: "animals",
    })).snapshot;
    expect(firstPage.ecosystem.supplies.animalFeed).toBe(0);

    firstPage = (await firstPageApi.command(command("insertCoin", firstPage.revision))).snapshot;
    expect(firstPage).toMatchObject({ wallet: 7, pendingSpin: { stage: "paid" } });

    const refilled = firstPageApi.refillTestResources();
    expect(refilled).toMatchObject({
      revision: firstPage.revision + 1,
      wallet: 99,
      pendingSpin: null,
      ecosystem: {
        supplies: { fishFeed: 9, fertilizer: 9, animalFeed: 9 },
      },
    });
    expect(await secondPageApi.getSnapshot("preview-second")).toMatchObject({
      revision: 0,
      wallet: 8,
      ecosystem: {
        supplies: { fishFeed: 1, fertilizer: 1, animalFeed: 1 },
      },
    });

    const caredAgain = await firstPageApi.command({
      ...base(refilled.revision, 2),
      type: "careHabitat",
      habitat: "animals",
    });
    expect(caredAgain).toMatchObject({
      status: 200,
      snapshot: { ecosystem: { supplies: { animalFeed: 8 } } },
    });
  });

  it("keeps the standalone 1850/10000 fixture interactive through Host-shaped spin stages", async () => {
    const api = new InMemoryGameApi({ rng: sequence(0.7) });
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

  it("uses the production spin resolver and settles a real collectible into inventory", async () => {
    const api = new InMemoryGameApi({
      rng: sequence(0.8, 0.2),
      createId: () => "preview-real-spin",
    });
    let state = await api.getSnapshot("preview");

    state = (await api.command(command("insertCoin", state.revision))).snapshot;
    expect(state).toMatchObject({
      wallet: 7,
      pendingSpin: {
        id: "preview-real-spin",
        stage: "paid",
        reels: ["leaf", "leaf", "leaf"],
        reward: {
          kind: "collectible",
          collectibleId: "book-stand",
          isDuplicate: false,
        },
      },
    });

    const spinId = state.pendingSpin!.id;
    state = (await api.command(command("pullLever", state.revision, { spinId }))).snapshot;
    state = (await api.command(command("settleSpin", state.revision, { spinId }))).snapshot;

    expect(state).toMatchObject({
      wallet: 7,
      inventory: ["plant", "book-stand"],
      pityCount: 0,
      pendingSpin: null,
    });
  });

  it("supports warehouse placement, moving, removal, and occupied-position rejection", async () => {
    const api = new InMemoryGameApi();
    let state = await api.getSnapshot("preview");
    state = (await api.command({
      ...base(state.revision, 10),
      type: "buyItem",
      itemId: "book-stand",
    })).snapshot;
    expect(state).toMatchObject({ inventory: ["plant", "book-stand"], wallet: 2 });

    state = (await api.command({
      ...base(state.revision, 11),
      type: "setPlacement",
      itemId: "plant",
      positionId: "left-front-round",
    })).snapshot;
    expect(state.tablePlacements).toEqual([
      { itemId: "plant", positionId: "left-front-round" },
    ]);

    const replaced = await api.command({
      ...base(state.revision, 12),
      type: "setPlacement",
      itemId: "book-stand",
      positionId: "left-front-round",
    });
    expect(replaced).toMatchObject({
      status: 200,
      snapshot: {
        displaySlots: ["book-stand"],
        tablePlacements: [{ itemId: "book-stand", positionId: "left-front-round" }],
      },
    });
    state = replaced.snapshot;

    state = (await api.command({
      ...base(state.revision, 13),
      type: "setPlacement",
      itemId: "plant",
      positionId: "right-front-round",
    })).snapshot;
    expect(state.displaySlots).toEqual(["book-stand", "plant"]);

    state = (await api.command({
      ...base(state.revision, 14),
      type: "setPlacement",
      itemId: "plant",
      positionId: null,
    })).snapshot;
    expect(state).toMatchObject({
      displaySlots: ["book-stand"],
      tablePlacements: [{ itemId: "book-stand", positionId: "left-front-round" }],
    });

    const unowned = await api.command({
      ...base(state.revision, 15),
      type: "setPlacement",
      itemId: "crystal",
      positionId: "left-rear-round",
    });
    expect(unowned).toMatchObject({ status: 409, errorCode: "item-not-owned" });
  });

  it("keeps legacy display commands synchronized with the first free physical position", async () => {
    const api = new InMemoryGameApi();
    let state = await api.getSnapshot("preview");

    state = (await api.command({
      ...base(state.revision, 20),
      type: "setDisplay",
      itemId: "plant",
      displayed: false,
    })).snapshot;
    expect(state).toMatchObject({ displaySlots: [], tablePlacements: [] });

    state = (await api.command({
      ...base(state.revision, 21),
      type: "setDisplay",
      itemId: "plant",
      displayed: true,
    })).snapshot;
    expect(state.tablePlacements).toEqual([
      { itemId: "plant", positionId: "left-rear-round" },
    ]);

    state = (await api.command({
      ...base(state.revision, 22),
      type: "setDisplay",
      itemId: "plant",
      displayed: true,
    })).snapshot;
    expect(state.tablePlacements).toHaveLength(1);

    const unowned = await api.command({
      ...base(state.revision, 23),
      type: "setDisplay",
      itemId: "crystal",
      displayed: true,
    });
    expect(unowned).toMatchObject({ status: 409, errorCode: "item-not-owned" });
  });

  it("reports preview conflicts for invalid revisions, purchases, spin stages, and aborted work", async () => {
    const api = new InMemoryGameApi();
    const state = await api.getSnapshot("preview");

    expect(await api.command({ ...base(99, 30), type: "claimDaily" })).toMatchObject({
      status: 409,
      errorCode: "revision-conflict",
    });
    expect(await api.command({ ...base(state.revision, 31), type: "buyItem", itemId: "unknown" }))
      .toMatchObject({ status: 409, errorCode: "unknown-item" });
    expect(await api.command({ ...base(state.revision, 32), type: "buyItem", itemId: "plant" }))
      .toMatchObject({ status: 409, errorCode: "already-owned" });
    expect(await api.command({ ...base(state.revision, 33), type: "buyItem", itemId: "crystal" }))
      .toMatchObject({ status: 409, errorCode: "insufficient-coins" });
    expect(await api.command({ ...base(state.revision, 34), type: "pullLever", spinId: "missing" }))
      .toMatchObject({ status: 409, errorCode: "invalid-spin-state" });
    expect(await api.command({ ...base(state.revision, 35), type: "settleSpin", spinId: "missing" }))
      .toMatchObject({ status: 409, errorCode: "invalid-spin-state" });

    const controller = new AbortController();
    controller.abort();
    await expect(api.getSnapshot("preview", controller.signal)).rejects.toThrow("Aborted");
    await expect(api.command({ ...base(state.revision, 36), type: "claimDaily" }, controller.signal))
      .rejects.toThrow("Aborted");
  });

  it("applies settings and treats the already-claimed daily grant as a no-op", async () => {
    const api = new InMemoryGameApi();
    let state = await api.getSnapshot("preview");
    state = (await api.command({ ...base(state.revision, 40), type: "claimDaily" })).snapshot;
    expect(state.revision).toBe(0);

    state = (await api.command({
      ...base(state.revision, 41),
      type: "updateSettings",
      patch: { muted: false, reducedMotion: true, scale: 2 },
    })).snapshot;
    expect(state).toMatchObject({
      revision: 1,
      settings: { muted: false, reducedMotion: true, scale: 2 },
    });
  });

  it("uses a controllable ecology clock for feeding, growth, crops, eggs, and collection", async () => {
    const api = new InMemoryGameApi();
    let state = await api.getSnapshot("preview");

    state = (await api.command({
      ...base(state.revision, 51),
      type: "careHabitat",
      habitat: "aquarium",
    })).snapshot;
    api.advanceTestEcosystem(6);
    state = await api.getSnapshot("preview");
    expect(state.ecosystem.lifecycle.fish.goldfish?.growth).toBeGreaterThan(0);

    state = (await api.command({
      ...base(state.revision, 52),
      type: "careHabitat",
      habitat: "garden",
    })).snapshot;
    api.advanceTestEcosystem(24);
    state = await api.getSnapshot("preview");
    expect(state.ecosystem.lifecycle.plots["1"].readyYield).toBe(1);
    const walletBeforeHarvest = state.wallet;

    state = (await api.command({
      ...base(state.revision, 53),
      type: "collectHabitat",
      habitat: "garden",
    })).snapshot;
    expect(state.ecosystem.lifecycle.produce.carrot).toBe(1);
    expect(state.wallet).toBeGreaterThan(walletBeforeHarvest);
    expect(await api.command({
      ...base(state.revision, 54),
      type: "collectHabitat",
      habitat: "garden",
    })).toMatchObject({ status: 409, errorCode: "nothing-to-collect" });

    api.advanceTestEcosystem(48);
    state = await api.getSnapshot("preview");
    expect(state.ecosystem.lifecycle.livestock.chick?.adults).toBeGreaterThanOrEqual(1);
    expect(state.ecosystem.lifecycle.livestock.chick?.readyProducts).toBeGreaterThanOrEqual(1);
  });
});

function sequence(...values: number[]) {
  let index = 0;
  return { next: () => values[index++] ?? values.at(-1) ?? 0 };
}

function base(expectedRevision: number, sequence: number) {
  return {
    commandId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    sessionId: "preview",
    expectedRevision,
    issuedAt: "2026-08-27T00:00:00.000Z",
  } as const;
}

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
