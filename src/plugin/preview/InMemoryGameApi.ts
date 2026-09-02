import { CATALOG_BY_ID } from "../../domain/catalog";
import { createInitialState } from "../../domain/types";
import { ECOSYSTEM_ITEM_BY_ID } from "../../ecosystem/catalog";
import {
  buyEcosystemItem,
  careForHabitat,
  collectHabitatProduce,
} from "../../ecosystem/ecosystem";
import { advanceEcosystemTo } from "../../ecosystem/lifecycle";
import { createPaidSpin } from "../../game/outcomes";
import { mathRandomSource, type RandomSource } from "../../game/rng";
import { settleActiveSpin } from "../../inventory/inventory";
import { FixedClock, localDateKey } from "../../time/clock";
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
const PREVIEW_NOW = new Date("2026-08-27T00:00:00.000Z");

interface InMemoryGameApiDependencies {
  readonly rng?: RandomSource;
  readonly createId?: () => string;
}

export class InMemoryGameApi implements GameApi {
  private readonly ecosystemClock = new FixedClock(PREVIEW_NOW);
  private readonly rng: RandomSource;
  private readonly createId: () => string;
  private nextSpinId = 1;
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
    ecosystem: createInitialState().ecosystem,
    settings: { muted: true, reducedMotion: false, scale: 1 },
    pendingSpin: null,
    agentStatus: "idle",
    capabilities: { commands: true },
  };

  constructor(dependencies: InMemoryGameApiDependencies = {}) {
    this.rng = dependencies.rng ?? mathRandomSource;
    this.createId = dependencies.createId ?? (() => `preview-spin-${this.nextSpinId++}`);
    this.synchronizeEcosystem();
  }

  getSnapshot(_sessionId: string, signal?: AbortSignal): Promise<PublicSnapshot> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    this.synchronizeEcosystem();
    return Promise.resolve(structuredClone(this.snapshot));
  }

  advanceTestEcosystem(hours: number): PublicSnapshot {
    if (!Number.isFinite(hours) || hours <= 0) return structuredClone(this.snapshot);
    const next = this.ecosystemClock.now();
    next.setTime(next.getTime() + hours * 60 * 60 * 1_000);
    this.ecosystemClock.set(next);
    this.synchronizeEcosystem();
    this.snapshot = {
      ...this.snapshot,
      revision: this.snapshot.revision + 1,
      localDate: localDateKey(next),
    };
    return structuredClone(this.snapshot);
  }

  refillTestResources(): PublicSnapshot {
    this.snapshot = {
      ...this.snapshot,
      revision: this.snapshot.revision + 1,
      wallet: 99,
      pendingSpin: null,
      ecosystem: {
        ...this.snapshot.ecosystem,
        supplies: { fishFeed: 9, fertilizer: 9, animalFeed: 9 },
      },
    };
    return structuredClone(this.snapshot);
  }

  command(input: CommandRequest, signal?: AbortSignal): Promise<CommandResult> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    const request = commandRequestSchema.parse(input);
    this.synchronizeEcosystem();
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
        const result = createPaidSpin(
          this.asGameState(),
          this.rng,
          this.ecosystemClock.now(),
          this.createId,
        );
        if (!result.ok) {
          return this.conflict(
            result.reason === "INSUFFICIENT_COINS"
              ? "insufficient-coins"
              : "invalid-spin-state",
          );
        }
        const spin = result.spin;
        return this.success({
          ...this.snapshot,
          wallet: result.state.wallet,
          pendingSpin: {
            id: spin.id,
            stage: "paid",
            reels: [...spin.reels],
            reward: spin.reward,
            pityAfter: spin.pityAfter,
            createdAt: spin.createdAt,
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
        const game = this.asGameState();
        game.activeSpin = { ...game.activeSpin!, stage: "payout" };
        const settled = settleActiveSpin(game, spin.id);
        return this.success({
          ...this.snapshot,
          wallet: settled.wallet,
          inventory: settled.ownedCollectibles,
          displaySlots: settled.displayedCollectibles,
          tablePlacements: settled.tablePlacements,
          ecosystem: settled.ecosystem,
          pityCount: settled.pityMisses,
          pendingSpin: null,
        });
      }
      case "buyItem": {
        const item = CATALOG_BY_ID[request.itemId];
        if (item === undefined) {
          if (ECOSYSTEM_ITEM_BY_ID[request.itemId] === undefined) return this.conflict("unknown-item");
          const result = buyEcosystemItem(this.asGameState(), request.itemId);
          if (!result.ok) return this.conflict(
            result.reason === "INSUFFICIENT_COINS" ? "insufficient-coins" :
              result.reason === "ALREADY_OWNED" ? "already-owned" :
                result.reason === "LOCKED_SPIN_REWARD" ? "locked-spin-reward" : "unknown-item",
          );
          return this.success({
            ...this.snapshot,
            wallet: result.state.wallet,
            ecosystem: result.state.ecosystem,
          });
        }
        if (this.snapshot.inventory.includes(item.id)) return this.conflict("already-owned");
        if (this.snapshot.wallet < item.price) return this.conflict("insufficient-coins");
        return this.success({
          ...this.snapshot,
          wallet: this.snapshot.wallet - item.price,
          inventory: [...this.snapshot.inventory, item.id],
        });
      }
      case "careHabitat": {
        const result = careForHabitat(this.asGameState(), request.habitat, this.ecosystemClock.now());
        if (!result.ok) return this.conflict("no-supply");
        return this.success({
          ...this.snapshot,
          wallet: result.state.wallet,
          ecosystem: result.state.ecosystem,
        });
      }
      case "collectHabitat": {
        const result = collectHabitatProduce(
          this.asGameState(),
          request.habitat,
          this.ecosystemClock.now(),
        );
        if (!result.ok) return this.conflict("nothing-to-collect");
        return this.success({
          ...this.snapshot,
          wallet: result.state.wallet,
          ecosystem: result.state.ecosystem,
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

  private synchronizeEcosystem(): void {
    this.snapshot = {
      ...this.snapshot,
      ecosystem: advanceEcosystemTo(this.snapshot.ecosystem, this.ecosystemClock.now()),
    };
  }

  private asGameState() {
    const state = createInitialState();
    state.wallet = this.snapshot.wallet;
    state.ecosystem = structuredClone(this.snapshot.ecosystem);
    state.ownedCollectibles = [...this.snapshot.inventory];
    state.activeSpin = this.snapshot.pendingSpin === null ? null : {
      ...structuredClone(this.snapshot.pendingSpin),
      stage: this.snapshot.pendingSpin.stage === "paid" ? "coin-inserted" : "spinning",
    };
    return state;
  }

  private conflict(errorCode: CommandErrorCode): CommandResult {
    return { status: 409, snapshot: structuredClone(this.snapshot), errorCode };
  }
}
