import type { GameState, ResolvedSpin } from "../domain/types";
import { settleActiveSpin } from "../inventory/inventory";
import { createPaidSpin, type OutcomeKind } from "./outcomes";
import type { RandomSource } from "./rng";

export type MachineEvent =
  | { type: "INSERT_COIN" }
  | { type: "PULL_LEVER" }
  | { type: "SPIN_ANIMATION_DONE" }
  | { type: "HIGHLIGHT_DONE" }
  | { type: "PAYOUT_DONE" }
  | { type: "CLEAR_SETTLED_SPIN" };

export interface MachineDependencies {
  rng: RandomSource;
  now: () => Date;
  createId: () => string;
  consumeOutcomeOverride?: () => OutcomeKind | null;
}

export function transitionMachine(
  state: GameState,
  event: MachineEvent,
  deps: MachineDependencies,
): GameState {
  switch (event.type) {
    case "INSERT_COIN": {
      if (state.wallet < 1 || state.activeSpin !== null) {
        return state;
      }

      const result = createPaidSpin(
        state,
        deps.rng,
        deps.now(),
        deps.createId,
        deps.consumeOutcomeOverride?.(),
      );
      return result.ok ? result.state : state;
    }

    case "PULL_LEVER":
      return moveSpinToStage(state, "coin-inserted", "spinning");

    case "SPIN_ANIMATION_DONE":
      return moveSpinToStage(state, "spinning", "highlight");

    case "HIGHLIGHT_DONE":
      return moveSpinToStage(state, "highlight", "payout");

    case "PAYOUT_DONE":
      return state.activeSpin?.stage === "payout"
        ? settleActiveSpin(state, state.activeSpin.id)
        : state;

    case "CLEAR_SETTLED_SPIN":
      return state.activeSpin?.stage === "settled" ? { ...state, activeSpin: null } : state;
  }
}

export function recoverInterruptedSpin(state: GameState): GameState {
  const spin = state.activeSpin;
  if (spin === null || spin.stage === "coin-inserted" || spin.stage === "settled") {
    return state;
  }

  return settleActiveSpin(state, spin.id);
}

function moveSpinToStage(
  state: GameState,
  expectedStage: ResolvedSpin["stage"],
  nextStage: ResolvedSpin["stage"],
): GameState {
  const spin = state.activeSpin;
  if (spin?.stage !== expectedStage) {
    return state;
  }

  return { ...state, activeSpin: { ...spin, stage: nextStage } };
}
