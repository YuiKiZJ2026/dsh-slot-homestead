import type { EligibleTurnUsage, ReportedTokenUsage } from "../shared/contracts";
import { reportedTokenUsageSchema } from "../shared/contracts";

export interface SessionEventLike {
  readonly type: string;
  readonly seq: number;
  readonly time: number;
  readonly data: unknown;
  readonly sourceEventSeqs?: readonly number[];
  readonly surfaceOp?: unknown;
  readonly ignorable?: true;
}

export interface SessionLike {
  readonly id: string;
  readonly header: {
    readonly version: number;
    readonly id: string;
    readonly createdAt: number;
    readonly parentSession?: string;
    readonly delegationDepth?: number;
  };
  readonly events: readonly SessionEventLike[];
}

interface AcceptedStepUsage {
  readonly seq: number;
  readonly usage: ReportedTokenUsage;
}

interface OpenTurn {
  readonly turn: number;
  trigger: "pending" | "eligible" | "ineligible";
  readonly steps: AcceptedStepUsage[];
}

export class SessionUsageCollector {
  private readonly openTurns = new Map<string, OpenTurn>();

  accept(session: SessionLike, event: SessionEventLike): EligibleTurnUsage | null {
    if (!isTopLevelSession(session)) {
      this.openTurns.delete(session.id);
      return null;
    }

    switch (event.type) {
      case "turn/start": {
        const turn = integerField(event.data, "turn");
        if (turn !== null) {
          this.openTurns.set(session.id, { turn, trigger: "pending", steps: [] });
        }
        return null;
      }

      case "user/message": {
        const open = this.openTurns.get(session.id);
        if (open !== undefined && open.trigger === "pending") {
          open.trigger = nestedStringField(event.data, "source", "kind") === "user"
            ? "eligible"
            : "ineligible";
        }
        return null;
      }

      case "assistant/message": {
        const open = this.openTurns.get(session.id);
        if (
          open === undefined ||
          integerField(event.data, "turn") !== open.turn
        ) {
          return null;
        }

        if (open.trigger === "pending") open.trigger = "ineligible";
        if (field(event.data, "interrupted") === true) return null;

        const usage = reportedTokenUsageSchema.safeParse(field(event.data, "usage"));
        if (usage.success) {
          if (isNonNegativeSafeInteger(event.seq)) {
            open.steps.push({ seq: event.seq, usage: usage.data });
          }
        }
        return null;
      }

      case "turn/end": {
        const open = this.openTurns.get(session.id);
        this.openTurns.delete(session.id);
        if (
          open === undefined ||
          integerField(event.data, "turn") !== open.turn ||
          nestedStringField(event.data, "reason", "kind") !== "completed" ||
          open.trigger !== "eligible" ||
          open.steps.length === 0
        ) {
          return null;
        }

        const [first, ...rest] = open.steps;
        return {
          sessionId: session.id,
          turn: open.turn,
          usageSeqs: [first.seq, ...rest.map((step) => step.seq)],
          stepUsages: [first.usage, ...rest.map((step) => step.usage)],
          occurredAt: new Date(event.time).toISOString(),
        };
      }

      default:
        return null;
    }
  }

  adopt(session: SessionLike): EligibleTurnUsage[] {
    return session.events.flatMap((event) => {
      const aggregate = this.accept(session, event);
      return aggregate === null ? [] : [aggregate];
    });
  }

  clear(): void {
    this.openTurns.clear();
  }
}

function isTopLevelSession(session: SessionLike): boolean {
  return session.header.parentSession === undefined &&
    (session.header.delegationDepth ?? 0) === 0;
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function integerField(value: unknown, key: string): number | null {
  const candidate = field(value, key);
  return Number.isSafeInteger(candidate) && (candidate as number) >= 0
    ? candidate as number
    : null;
}

function nestedStringField(value: unknown, parent: string, key: string): string | null {
  const candidate = field(field(value, parent), key);
  return typeof candidate === "string" ? candidate : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
