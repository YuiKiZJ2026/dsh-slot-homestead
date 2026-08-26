import type { AgentStatus } from "../domain/types";

export type DshEvent =
  | {
      id: string;
      type: "task.completed";
      occurredAt: string;
      taskId: string;
    }
  | {
      id: string;
      type: "task.verified";
      occurredAt: string;
      taskId: string;
    }
  | {
      id: string;
      type: "focus.minutes";
      occurredAt: string;
      minutes: number;
    }
  | {
      id: string;
      type: "agent.status";
      occurredAt: string;
      status: AgentStatus;
    };
