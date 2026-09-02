import { z } from "zod";
import {
  publicSnapshotSchema,
  type CommandRequest,
  type CommandResult,
  type PublicSnapshot,
} from "../shared/contracts";

const STATE_PATH = "/api/dsh-slot-widget/state";
const COMMAND_PATH = "/api/dsh-slot-widget/command";
const errorCodeSchema = z.enum([
  "revision-conflict",
  "command-id-reused",
  "command-expired",
  "clock-skew",
  "insufficient-coins",
  "invalid-spin-state",
  "unknown-item",
  "already-owned",
  "no-supply",
  "nothing-to-collect",
  "locked-spin-reward",
  "item-not-owned",
  "position-occupied",
]);
const successEnvelopeSchema = z.object({ snapshot: publicSnapshotSchema }).strict();
const conflictEnvelopeSchema = z.object({
  snapshot: publicSnapshotSchema,
  errorCode: errorCodeSchema,
}).strict();

export interface GameApi {
  getSnapshot(sessionId: string, signal?: AbortSignal): Promise<PublicSnapshot>;
  command(request: CommandRequest, signal?: AbortSignal): Promise<CommandResult>;
}

export class HttpGameApi implements GameApi {
  private readonly baseUrl: string;

  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    baseUrl = "",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getSnapshot(sessionId: string, signal?: AbortSignal): Promise<PublicSnapshot> {
    const query = new URLSearchParams({ sessionId });
    const response = await this.fetcher(`${this.baseUrl}${STATE_PATH}?${query}`, { method: "GET", signal });
    if (response.status !== 200) throw await responseError(response);
    return successEnvelopeSchema.parse(await response.json()).snapshot;
  }

  async command(request: CommandRequest, signal?: AbortSignal): Promise<CommandResult> {
    const response = await this.fetcher(`${this.baseUrl}${COMMAND_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    const body: unknown = await response.json();
    if (response.status === 200) {
      return { status: 200, snapshot: successEnvelopeSchema.parse(body).snapshot };
    }
    if (response.status === 409) {
      const conflict = conflictEnvelopeSchema.parse(body);
      return { status: 409, snapshot: conflict.snapshot, errorCode: conflict.errorCode };
    }
    throw new Error(`DSH game command failed with HTTP ${response.status}`);
  }
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as { error?: { code?: unknown } };
    const code = typeof body.error?.code === "string" ? `: ${body.error.code}` : "";
    return new Error(`DSH game state failed with HTTP ${response.status}${code}`);
  } catch {
    return new Error(`DSH game state failed with HTTP ${response.status}`);
  }
}
