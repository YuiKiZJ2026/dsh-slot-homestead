import type { CommandResult, PublicSnapshot } from "../shared/contracts";
import { commandRequestSchema } from "../shared/contracts";

export const STATE_PATH = "/api/dsh-slot-widget/state";
export const COMMAND_PATH = "/api/dsh-slot-widget/command";
const MAX_BODY_BYTES = 16 * 1_024;

export interface HttpGameService {
  getSnapshot(sessionId: string): Promise<PublicSnapshot>;
  command(request: unknown): Promise<CommandResult>;
}

export interface HostWebRoute {
  readonly kind: "exact";
  readonly path: string;
  readonly handler: (request: HttpRequestLike | Request, response: HttpResponseLike) => Promise<void>;
}

interface HttpRequestLike extends AsyncIterable<Uint8Array | string> {
  readonly method?: string;
  readonly url?: string;
  readonly headers: Record<string, string | readonly string[] | undefined>;
}

interface HttpResponseLike {
  writeHead(status: number, headers?: Record<string, string>): unknown;
  end(body?: string): unknown;
}

export function stateRoute(service: HttpGameService): HostWebRoute {
  return {
    kind: "exact",
    path: STATE_PATH,
    handler: async (request, response) => {
      try {
        await send(response, await handleStateRequest(await toRequest(request), service));
      } catch (error) {
        const code = error instanceof BodyTooLargeError ? "body-too-large" : "bad-request";
        await send(response, jsonError(code, error instanceof BodyTooLargeError ? 413 : 400));
      }
    },
  };
}

export function commandRoute(service: HttpGameService): HostWebRoute {
  return {
    kind: "exact",
    path: COMMAND_PATH,
    handler: async (request, response) => {
      try {
        await send(response, await handleCommandRequest(await toRequest(request), service));
      } catch (error) {
        const code = error instanceof BodyTooLargeError ? "body-too-large" : "bad-request";
        await send(response, jsonError(code, error instanceof BodyTooLargeError ? 413 : 400));
      }
    },
  };
}

export async function handleStateRequest(
  request: Request,
  service: Pick<HttpGameService, "getSnapshot">,
): Promise<Response> {
  if (!isTrustedRequest(request)) return jsonError("forbidden", 403);
  if (request.method !== "GET") return jsonError("method-not-allowed", 405);

  const url = new URL(request.url);
  if (url.pathname !== STATE_PATH) return jsonError("not-found", 404);
  const keys = [...url.searchParams.keys()];
  const sessionIds = url.searchParams.getAll("sessionId");
  if (
    keys.length !== 1 ||
    keys[0] !== "sessionId" ||
    sessionIds.length !== 1 ||
    sessionIds[0]!.length === 0 ||
    sessionIds[0]!.length > 256
  ) {
    return jsonError("bad-query", 400);
  }

  try {
    return json({ snapshot: await service.getSnapshot(sessionIds[0]!) }, 200);
  } catch {
    return jsonError("storage-error", 503);
  }
}

export async function handleCommandRequest(
  request: Request,
  service: Pick<HttpGameService, "command">,
): Promise<Response> {
  if (!isTrustedRequest(request)) return jsonError("forbidden", 403);
  if (request.method !== "POST") return jsonError("method-not-allowed", 405);

  const url = new URL(request.url);
  if (url.pathname !== COMMAND_PATH || url.search !== "") return jsonError("not-found", 404);
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    return jsonError("unsupported-media-type", 415);
  }

  let body: string;
  try {
    body = await readFetchBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return jsonError("body-too-large", 413);
    return jsonError("invalid-json", 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonError("invalid-json", 400);
  }
  const command = commandRequestSchema.safeParse(parsed);
  if (!command.success) return jsonError("invalid-command", 400);

  try {
    const result = await service.command(command.data);
    return json(
      result.errorCode === undefined
        ? { snapshot: result.snapshot }
        : { snapshot: result.snapshot, errorCode: result.errorCode },
      result.status,
    );
  } catch {
    return jsonError("storage-error", 503);
  }
}

function isTrustedRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (host === null || !isLoopbackHost(host)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin === null || origin === "null") return true;
  if (origin === "app://dsh") return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === host;
  } catch {
    return false;
  }
}

function isLoopbackHost(authority: string): boolean {
  try {
    const hostname = new URL(`http://${authority}`).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

async function readFetchBody(request: Request, limit: number): Promise<string> {
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    length += result.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function toRequest(request: HttpRequestLike | Request): Promise<Request> {
  if (request instanceof Request) return request;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value as string);
  }
  const contentLength = Number(headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }
  const method = request.method ?? "GET";
  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await readNodeBody(request, MAX_BODY_BYTES);
  const authority = headers.get("host") ?? "invalid.invalid";
  return new Request(new URL(request.url ?? "/", `http://${authority}`), {
    method,
    headers,
    body,
  });
}

async function readNodeBody(request: HttpRequestLike, limit: number): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    length += bytes.byteLength;
    if (length > limit) throw new BodyTooLargeError();
    chunks.push(bytes);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

async function send(response: HttpResponseLike, fetchResponse: Response): Promise<void> {
  const headers: Record<string, string> = {};
  fetchResponse.headers.forEach((value, key) => { headers[key] = value; });
  response.writeHead(fetchResponse.status, headers);
  response.end(await fetchResponse.text());
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function jsonError(code: string, status: number): Response {
  return json({ error: { code } }, status);
}

class BodyTooLargeError extends Error {}
