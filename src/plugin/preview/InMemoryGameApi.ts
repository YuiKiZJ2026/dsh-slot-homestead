import { CATALOG_BY_ID } from "../../domain/catalog";
import { TABLE_POSITIONS } from "../../domain/table-positions";
import {
  commandRequestSchema,
  type CommandErrorCode,
  type CommandRequest,
  type CommandResult,
  type PublicSnapshot,
} from "../shared/contracts";
import type { GameApi } from "../client/api";

const PREVIEW_DATE = "2026-08-27";

export class InMemoryGameApi implements GameApi {
  private snapshot: PublicSnapshot = {
    revision: 0,
    wallet: 8,
    localDate: PREVIEW_DATE,
    lastGrantedLocalDate: PREVIEW_DATE,
    daily: { [PREVIEW_DATE]: { workCoins: 3 } },
    tokenEnergy: { progress: 1_850, dailyCoins: { [PREVIEW_DATE]: 3 } },
    pityCount: 0,
    inventory: ["plant"],
    displaySlots: ["plant"],
    tablePlacements: [{ itemId: "plant", positionId: "left-rear-round" }],
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    agentStatus: "idle",
    capabilities: { commands: true },
  };

  getSnapshot(_sessionId: string, signal?: AbortSignal): Promise<PublicSnapshot> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return Promise.resolve(structuredClone(this.snapshot));
  }

  command(input: CommandRequest, signal?: AbortSignal): Promise<CommandResult> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    const request = commandRequestSchema.parse(input);
    if (request.expectedRevision !== this.snapshot.revision) {
      return Promise.resolve(this.conflict("revision-conflict"));
    }
    const result = this.transition(request);
    return Promise.resolve(result);
  }

  private transition(request: CommandRequest): CommandResult {
    switch (request.type) {
      case "claimDaily":
        return this.success(this.snapshot, false);
      case "insertCoin": {
        if (this.snapshot.wallet < 1) return this.conflict("insufficient-coins");
        if (this.snapshot.pendingSpin !== null) return this.conflict("invalid-spin-state");
        return this.success({
          ...this.snapshot,
          wallet: this.snapshot.wallet - 1,
          pendingSpin: {
            id: `preview-spin-${this.snapshot.revision + 1}`,
            stage: "paid",
            reels: ["coin", "coin", "coin"],
            reward: { kind: "coins", amount: 5, reason: "five-coins" },
            pityAfter: 0,
            createdAt: "2026-08-27T00:00:00.000Z",
          },
        });
      }
      case "pullLever": {
        const spin = this.snapshot.pendingSpin;
        if (spin === null || spin.id !== request.spinId || spin.stage !== "paid") {
          return this.conflict("invalid-spin-state");
        }
        return this.success({ ...this.snapshot, pendingSpin: { ...spin, stage: "spinning" } });
      }
      case "settleSpin": {
        const spin = this.snapshot.pendingSpin;
        if (spin === null || spin.id !== request.spinId || spin.stage !== "spinning") {
          return this.conflict("invalid-spin-state");
        }
        const coinReward = spin.reward.kind === "coins" ? spin.reward.amount : 0;
        return this.success({
          ...this.snapshot,
          wallet: this.snapshot.wallet + coinReward,
          pityCount: spin.pityAfter,
          pendingSpin: null,
        });
      }
      case "buyItem": {
        const item = CATALOG_BY_ID[request.itemId];
        if (item === undefined) return this.conflict("unknown-item");
        if (this.snapshot.inventory.includes(item.id)) return this.conflict("already-owned");
        if (this.snapshot.wallet < item.price) return this.conflict("insufficient-coins");
        return this.success({
          ...this.snapshot,
          wallet: this.snapshot.wallet - item.price,
          inventory: [...this.snapshot.inventory, item.id],
        });
      }
      case "setDisplay": {
        if (!this.snapshot.inventory.includes(request.itemId)) return this.conflict("item-not-owned");
        const displaySlots = request.displayed
          ? [...new Set([...this.snapshot.displaySlots, request.itemId])].slice(0, 12)
          : this.snapshot.displaySlots.filter((id) => id !== request.itemId);
        const currentPlacements = this.snapshot.tablePlacements ?? [];
        const alreadyPlaced = currentPlacements.some(({ itemId }) => itemId === request.itemId);
        const freePosition = TABLE_POSITIONS.find((position) => !currentPlacements.some(
          ({ positionId }) => positionId === position.id,
        ));
        const tablePlacements = request.displayed
          ? alreadyPlaced || freePosition === undefined
            ? currentPlacements
            : [...currentPlacements, { itemId: request.itemId, positionId: freePosition.id }]
          : currentPlacements.filter(({ itemId }) => itemId !== request.itemId);
        return this.success({ ...this.snapshot, displaySlots, tablePlacements });
      }
      case "setPlacement": {
        if (!this.snapshot.inventory.includes(request.itemId)) return this.conflict("item-not-owned");
        const current = this.snapshot.tablePlacements ?? [];
        const withoutItem = current.filter(({ itemId, positionId }) => (
          itemId !== request.itemId && (request.positionId === null || positionId !== request.positionId)
        ));
        const tablePlacements = request.positionId === null
          ? withoutItem
          : [...withoutItem, { itemId: request.itemId, positionId: request.positionId }];
        return this.success({
          ...this.snapshot,
          displaySlots: tablePlacements.map(({ itemId }) => itemId),
          tablePlacements,
        });
      }
      case "updateSettings":
        return this.success({
          ...this.snapshot,
          settings: { ...this.snapshot.settings, ...request.patch },
        });
    }
  }

  private success(next: PublicSnapshot, changed = true): CommandResult {
    this.snapshot = changed ? { ...next, revision: this.snapshot.revision + 1 } : next;
    return { status: 200, snapshot: structuredClone(this.snapshot) };
  }

  private conflict(errorCode: CommandErrorCode): CommandResult {
    return { status: 409, snapshot: structuredClone(this.snapshot), errorCode };
  }
}
