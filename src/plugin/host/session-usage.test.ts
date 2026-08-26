import { describe, expect, it } from "vitest";
import type { ReportedTokenUsage } from "../shared/contracts";
import {
  SessionUsageCollector,
  type SessionEventLike,
  type SessionLike,
} from "./session-usage";

const SESSION_ID = "session-main";
const TURN = 7;
const BASE_TIME = Date.parse("2026-08-26T04:00:00.000Z");

function session(
  header: Partial<SessionLike["header"]> = {},
  events: readonly SessionEventLike[] = [],
): SessionLike {
  return {
    id: SESSION_ID,
    header: {
      version: 0,
      id: SESSION_ID,
      createdAt: BASE_TIME - 1_000,
      delegationDepth: 0,
      ...header,
    },
    events,
  };
}

function turnStart(seq = 10): SessionEventLike {
  return { type: "turn/start", seq, time: BASE_TIME, data: { turn: TURN } };
}

function userMessage(kind: "user" | "plugin" | "goal" | "background" | "synthetic" = "user", seq = 11): SessionEventLike {
  return {
    type: "user/message",
    seq,
    time: BASE_TIME + seq,
    data: {
      id: `message-${seq}`,
      role: "user",
      content: [{ type: "text", text: "Do the work" }],
      source: kind === "plugin" ? { kind, plugin: "fixture" } : { kind },
    },
    surfaceOp: "append",
  };
}

function assistantMessage(
  seq: number,
  step: number,
  usage?: ReportedTokenUsage,
  interrupted = false,
): SessionEventLike {
  return {
    type: "assistant/message",
    seq,
    time: BASE_TIME + seq,
    data: {
      turn: TURN,
      step,
      message: {
        id: `assistant-${seq}`,
        role: "assistant",
        content: [{ type: "text", text: `step ${step}` }],
      },
      ...(usage === undefined ? {} : { usage }),
      ...(interrupted ? { interrupted: true as const } : {}),
    },
    sourceEventSeqs: [seq - 1],
    surfaceOp: "append",
  };
}

function turnEnd(
  reason:
    | { kind: "completed" }
    | { kind: "aborted"; reason: { kind: "user" } }
    | { kind: "max-tokens" },
  seq = 20,
): SessionEventLike {
  return {
    type: "turn/end",
    seq,
    time: BASE_TIME + seq,
    data: { turn: TURN, reason },
  };
}

function collect(
  subject: SessionLike,
  events: readonly SessionEventLike[],
) {
  const collector = new SessionUsageCollector();
  return events.flatMap((event) => {
    const aggregate = collector.accept(subject, event);
    return aggregate === null ? [] : [aggregate];
  });
}

describe("session usage collector", () => {
  it("aggregates every successful model step in one completed human top-level turn", () => {
    const subject = session();
    const events = [
      turnStart(),
      userMessage(),
      assistantMessage(13, 1, { inputTokens: 100, outputTokens: 200 }),
      assistantMessage(17, 2, {
        inputTokens: 300,
        outputTokens: 400,
        cacheReadTokens: 500,
      }),
      turnEnd({ kind: "completed" }),
    ];

    expect(collect(subject, events)).toEqual([
      {
        sessionId: SESSION_ID,
        turn: TURN,
        usageSeqs: [13, 17],
        stepUsages: [
          { inputTokens: 100, outputTokens: 200 },
          { inputTokens: 300, outputTokens: 400, cacheReadTokens: 500 },
        ],
        occurredAt: new Date(BASE_TIME + 20).toISOString(),
      },
    ]);
  });

  it.each([
    ["parent session", session({ parentSession: "session-parent" })],
    ["delegation depth", session({ delegationDepth: 1 })],
  ])("rejects an otherwise eligible turn from a %s", (_case, subject) => {
    expect(collect(subject, [
      turnStart(),
      userMessage(),
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
      turnEnd({ kind: "completed" }),
    ])).toEqual([]);
  });

  it.each(["plugin", "goal"] as const)(
    "rejects a turn entered from a %s user-message source",
    (kind) => {
      const subject = session();
      expect(collect(subject, [
        turnStart(),
        userMessage(kind),
        assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
        turnEnd({ kind: "completed" }),
      ])).toEqual([]);
    },
  );

  it.each(["synthetic", "background", "plugin", "goal"] as const)(
    "does not retrofit a %s-triggered turn when a human steers after assistant usage",
    (kind) => {
      const subject = session();
      expect(collect(subject, [
        turnStart(),
        userMessage(kind),
        assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
        userMessage("user", 14),
        turnEnd({ kind: "completed" }),
      ])).toEqual([]);
    },
  );

  it("freezes an untriggered turn as ineligible when assistant usage arrives first", () => {
    const subject = session();
    expect(collect(subject, [
      turnStart(),
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
      userMessage("user", 14),
      turnEnd({ kind: "completed" }),
    ])).toEqual([]);
  });

  it.each([
    ["missing usage", assistantMessage(13, 1)],
    ["invalid usage", assistantMessage(13, 1, { inputTokens: 0, outputTokens: -1 })],
    [
      "interrupted output",
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 100 }, true),
    ],
  ])("freezes an untriggered turn before parsing %s", (_label, firstAssistant) => {
    const subject = session();
    expect(collect(subject, [
      turnStart(),
      firstAssistant,
      userMessage("user", 14),
      assistantMessage(17, 2, { inputTokens: 0, outputTokens: 3_000 }),
      turnEnd({ kind: "completed" }),
    ])).toEqual([]);
  });

  it("does not upgrade a plugin trigger when human steering arrives before the first assistant", () => {
    const subject = session();
    expect(collect(subject, [
      turnStart(),
      userMessage("plugin"),
      userMessage("user", 12),
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
      turnEnd({ kind: "completed" }),
    ])).toEqual([]);
  });

  it("keeps a human-triggered turn eligible through later messages and model steps", () => {
    const subject = session();
    const events = [
      turnStart(),
      userMessage("user"),
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 1_000 }),
      userMessage("synthetic", 14),
      assistantMessage(17, 2, { inputTokens: 0, outputTokens: 2_000 }),
      turnEnd({ kind: "completed" }),
    ];

    expect(collect(subject, events)).toEqual([
      {
        sessionId: SESSION_ID,
        turn: TURN,
        usageSeqs: [13, 17],
        stepUsages: [
          { inputTokens: 0, outputTokens: 1_000 },
          { inputTokens: 0, outputTokens: 2_000 },
        ],
        occurredAt: new Date(BASE_TIME + 20).toISOString(),
      },
    ]);
  });

  it.each([
    ["missing usage", assistantMessage(13, 1)],
    [
      "interrupted assistant",
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }, true),
    ],
  ])("rejects a completed turn with %s", (_case, assistant) => {
    const subject = session();
    expect(collect(subject, [
      turnStart(),
      userMessage(),
      assistant,
      turnEnd({ kind: "completed" }),
    ])).toEqual([]);
  });

  it.each([
    { kind: "aborted", reason: { kind: "user" } } as const,
    { kind: "max-tokens" } as const,
  ])("rejects a turn ending with $kind", (reason) => {
    const subject = session();
    expect(collect(subject, [
      turnStart(),
      userMessage(),
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
      turnEnd(reason),
    ])).toEqual([]);
  });

  it("uses the live reducer for adopted history and forgets a closed turn", () => {
    const events = [
      turnStart(),
      userMessage(),
      assistantMessage(13, 1, { inputTokens: 0, outputTokens: 3_000 }),
      turnEnd({ kind: "completed" }),
    ];
    const subject = session({}, events);
    const collector = new SessionUsageCollector();

    expect(collector.adopt(subject)).toEqual(collect(subject, events));
    expect(collector.accept(
      subject,
      assistantMessage(21, 2, { inputTokens: 0, outputTokens: 3_000 }),
    )).toBeNull();
    expect(collector.accept(subject, turnEnd({ kind: "completed" }, 22))).toBeNull();
  });
});
