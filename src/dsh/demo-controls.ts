import type { AgentStatus } from "../domain/types";
import type { OutcomeKind } from "../game/outcomes";

export interface DshDemoControls {
  completeTask(): string;
  verifyTask(taskId: string): void;
  addFocusHour(): void;
  setAgentStatus(status: AgentStatus): void;
  advanceDay(): void;
  presetNextOutcome(outcome: OutcomeKind): void;
  consumeNextOutcome(): OutcomeKind | null;
}
