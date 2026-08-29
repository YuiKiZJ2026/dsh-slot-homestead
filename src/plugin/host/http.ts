import type { CommandResult, PublicSnapshot } from "../shared/contracts";
import { commandRequestSchema } from "../shared/contracts";

export const STATE_PATH = "/api/dsh-slot-widget/state";
export const COMMAND_PATH = "/api/dsh-slot-widget/command";
export const COMPANION_PATH = "/api/dsh-slot-widget/companion";
export const COMPANION_WINDOW_PATH = "/api/dsh-slot-widget/window";
export const COMPANION_SCRIPT_PATH = "/api/dsh-slot-widget/companion.js";
const MAX_BODY_BYTES = 16 * 1_024;
const COMPANION_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>DSH 桌面老虎机</title></head>
<body><div id="root"></div><script src="${COMPANION_SCRIPT_PATH}"></script></body></html>`;

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

export function companionRoute(
  status: () => "starting" | "active" | "unavailable",
): HostWebRoute {
  return {
    kind: "exact",
    path: COMPANION_PATH,
    handler: async (request, response) => {
      try {
        const adapted = await toRequest(request);
        const result = !isTrustedRequest(adapted)
          ? jsonError("forbidden", 403)
          : adapted.method !== "GET"
            ? jsonError("method-not-allowed", 405)
            : new URL(adapted.url).pathname !== COMPANION_PATH
              ? jsonError("not-found", 404)
              : json({ status: status() }, 200);
        await send(response, withCompanionCors(adapted, result));
      } catch {
        await send(response, jsonError("bad-request", 400));
      }
    },
  };
}

export function companionWindowRoute(): HostWebRoute {
  return staticTextRoute(
    COMPANION_WINDOW_PATH,
    () => COMPANION_HTML,
    "text/html; charset=utf-8",
    {
      "content-security-policy": [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'unsafe-inline'",
        "img-src data:",
        "connect-src 'self'",
      ].join("; "),
    },
  );
}

export function companionScriptRoute(loadScript: () => string): HostWebRoute {
  return staticTextRoute(
    COMPANION_SCRIPT_PATH,
    loadScript,
    "text/javascript; charset=utf-8",
  );
}

function staticTextRoute(
  path: string,
  loadBody: () => string,
  contentType: string,
  extraHeaders: Record<string, string> = {},
): HostWebRoute {
  return {
    kind: "exact",
    path,
    handler: async (request, response) => {
      try {
        const adapted = await toRequest(request);
        const requestPath = new URL(adapted.url).pathname;
        if (!isTrustedRequest(adapted)) {
          await send(response, jsonError("forbidden", 403));
          return;
        }
        if (adapted.method !== "GET") {
          await send(response, jsonError("method-not-allowed", 405));
          return;
        }
        if (requestPath !== path) {
          await send(response, jsonError("not-found", 404));
          return;
        }
        await send(response, new Response(loadBody(), {
          status: 200,
          headers: {
            "content-type": contentType,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            ...extraHeaders,
          },
        }));
      } catch {
        await send(response, jsonError("companion-asset-error", 500));
      }
    },
  };
}

export async function handleStateRequest(
  request: Request,
  service: Pick<HttpGameService, "getSnapshot">,
): Promise<Response> {
  if (!isTrustedRequest(request)) return jsonError("forbidden", 403);
  const finish = (response: Response): Response => withCompanionCors(request, response);
  if (request.method === "OPTIONS") return finish(preflightResponse(request, "GET"));
  if (request.method !== "GET") return finish(jsonError("method-not-allowed", 405));

  const url = new URL(request.url);
  if (url.pathname !== STATE_PATH) return finish(jsonError("not-found", 404));
  const keys = [...url.searchParams.keys()];
  const sessionIds = url.searchParams.getAll("sessionId");
  if (
    keys.length !== 1 ||
    keys[0] !== "sessionId" ||
    sessionIds.length !== 1 ||
    sessionIds[0]!.length === 0 ||
    sessionIds[0]!.length > 256
  ) {
    return finish(jsonError("bad-query", 400));
  }

  try {
    return finish(json({ snapshot: await service.getSnapshot(sessionIds[0]!) }, 200));
  } catch {
    return finish(jsonError("storage-error", 503));
  }
}

export async function handleCommandRequest(
  request: Request,
  service: Pick<HttpGameService, "command">,
): Promise<Response> {
  if (!isTrustedRequest(request)) return jsonError("forbidden", 403);
  const finish = (response: Response): Response => withCompanionCors(request, response);
  if (request.method === "OPTIONS") return finish(preflightResponse(request, "POST"));
  if (request.method !== "POST") return finish(jsonError("method-not-allowed", 405));

  const url = new URL(request.url);
  if (url.pathname !== COMMAND_PATH || url.search !== "") return finish(jsonError("not-found", 404));
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    return finish(jsonError("unsupported-media-type", 415));
  }

  let body: string;
  try {
    body = await readFetchBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return finish(jsonError("body-too-large", 413));
    return finish(jsonError("invalid-json", 400));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return finish(jsonError("invalid-json", 400));
  }
  const command = commandRequestSchema.safeParse(parsed);
  if (!command.success) return finish(jsonError("invalid-command", 400));

  try {
    const result = await service.command(command.data);
    return finish(json(
      result.errorCode === undefined
        ? { snapshot: result.snapshot }
        : { snapshot: result.snapshot, errorCode: result.errorCode },
      result.status,
    ));
  } catch {
    return finish(jsonError("storage-error", 503));
  }
}

function isTrustedRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (host === null || !isLoopbackHost(host)) return false;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (companionCorsOrigin(request) !== null) {
    return fetchSite === null || ["cross-site", "same-site", "same-origin", "none"].includes(fetchSite);
  }
  if (
    origin === null &&
    fetchSite === "cross-site" &&
    request.headers.get("sec-fetch-mode") === "cors" &&
    request.headers.get("sec-fetch-dest") === "empty"
  ) return true;
  if (fetchSite !== null && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  if (origin === null) return true;
  if (origin === "app://dsh") return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === host;
  } catch {
    return false;
  }
}

function preflightResponse(request: Request, method: "GET" | "POST"): Response {
  const requestedMethod = request.headers.get("access-control-request-method");
  const requestedHeaders = request.headers.get("access-control-request-headers") ?? "";
  if (
    companionCorsOrigin(request) === null ||
    requestedMethod !== method ||
    (requestedHeaders !== "" && requestedHeaders.toLowerCase() !== "content-type")
  ) return jsonError("forbidden", 403);
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": `${method}, OPTIONS`,
      "access-control-allow-headers": requestedHeaders.toLowerCase(),
      "access-control-max-age": "600",
    },
  });
}

function withCompanionCors(request: Request, response: Response): Response {
  const origin = companionCorsOrigin(request);
  if (origin === null) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function companionCorsOrigin(request: Request): "null" | "file://" | "file:///" | null {
  const origin = request.headers.get("origin");
  return origin === "null" || origin === "file://" || origin === "file:///" ? origin : null;
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
