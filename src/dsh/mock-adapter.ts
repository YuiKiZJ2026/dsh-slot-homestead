/// <reference types="vite/client" />

import type { AgentStatus } from "../domain/types";
import type { OutcomeKind } from "../game/outcomes";
import { FixedClock } from "../time/clock";
import type { DshAdapter } from "./adapter";
import type { DshDemoControls } from "./demo-controls";
import { developmentOutcomeOverridesEnabled } from "./dev-outcome-gate";
import type { DshEvent } from "./events";

export class MockDshAdapter implements DshAdapter, DshDemoControls {
  private readonly listeners = new Set<(event: DshEvent) => void>();
  private readonly usedIds = new Set<string>();
  private readonly suffixes = new Map<string, number>();
  private nextOutcome: OutcomeKind | null = null;
  private readonly outcomeOverridesEnabled: boolean;

  constructor(
    private readonly clock: FixedClock,
    private readonly createId: () => string,
    requestDevelopmentOverrides = true,
  ) {
    this.outcomeOverridesEnabled = developmentOutcomeOverridesEnabled(
      import.meta.env.DEV,
      requestDevelopmentOverrides,
    );
  }

  subscribe(listener: (event: DshEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  completeTask(): string {
    const taskId = this.uniqueId();
    this.emit({
      id: this.uniqueId(),
      type: "task.completed",
      occurredAt: this.clock.now().toISOString(),
      taskId,
    });
    return taskId;
  }

  verifyTask(taskId: string): void {
    this.emit({
      id: this.uniqueId(),
      type: "task.verified",
      occurredAt: this.clock.now().toISOString(),
      taskId,
    });
  }

  addFocusHour(): void {
    this.emit({
      id: this.uniqueId(),
      type: "focus.minutes",
      occurredAt: this.clock.now().toISOString(),
      minutes: 60,
    });
  }

  setAgentStatus(status: AgentStatus): void {
    this.emit({
      id: this.uniqueId(),
      type: "agent.status",
      occurredAt: this.clock.now().toISOString(),
      status,
    });
  }

  advanceDay(): void {
    const next = this.clock.now();
    next.setDate(next.getDate() + 1);
    this.clock.set(next);
  }

  presetNextOutcome(outcome: OutcomeKind): void {
    if (this.outcomeOverridesEnabled) {
      this.nextOutcome = outcome;
    }
  }

  consumeNextOutcome(): OutcomeKind | null {
    if (!this.outcomeOverridesEnabled) {
      return null;
    }

    const outcome = this.nextOutcome;
    this.nextOutcome = null;
    return outcome;
  }

  private emit(event: DshEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  private uniqueId(): string {
    const base = this.createId();
    let suffix = this.suffixes.get(base) ?? 0;
    let candidate = suffix === 0 ? base : `${base}-${suffix}`;

    while (this.usedIds.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    this.suffixes.set(base, suffix + 1);
    this.usedIds.add(candidate);
    return candidate;
  }
}
