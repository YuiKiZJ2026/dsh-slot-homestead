// @ts-expect-error Node built-ins are available in the DSH Host runtime.
import { randomBytes } from "node:crypto";
// @ts-expect-error Node built-ins are available in the DSH Host runtime.
import { createServer } from "node:http";
import {
  COMMAND_PATH,
  STATE_PATH,
  commandRoute,
  stateRoute,
  type HostWebRoute,
  type HttpGameService,
} from "./http";

export interface CompanionServerHandle {
  readonly apiBase: string;
  readonly pageUrl: string;
  close(): Promise<void>;
}

export async function startCompanionServer(
  service: HttpGameService,
  loadScript: () => string,
  createCapability: () => string = () => randomBytes(32).toString("base64url"),
): Promise<CompanionServerHandle> {
  const capability = createCapability();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(capability)) {
    throw new Error("Companion capability must be an unguessable URL-safe token");
  }
  const prefix = `/${capability}`;
  const state = stateRoute(service);
  const command = commandRoute(service);
  const server = createServer((request: any, response: any) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500, secureHeaders("text/plain; charset=utf-8"));
      response.end("companion-server-error");
    });
  });

  async function handle(request: any, response: any): Promise<void> {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!requestUrl.pathname.startsWith(`${prefix}/`)) {
      response.writeHead(404, secureHeaders("text/plain; charset=utf-8"));
      response.end("not-found");
      return;
    }
    if (request.method !== "GET" && request.method !== "POST" && request.method !== "OPTIONS") {
      response.writeHead(405, secureHeaders("text/plain; charset=utf-8"));
      response.end("method-not-allowed");
      return;
    }

    const relativePath = requestUrl.pathname.slice(prefix.length);
    if (request.method === "GET" && relativePath === "/window") {
      response.writeHead(200, {
        ...secureHeaders("text/html; charset=utf-8"),
        "content-security-policy": [
          "default-src 'none'",
          "script-src 'self'",
          "style-src 'unsafe-inline'",
          "img-src data:",
          "connect-src 'self'",
        ].join("; "),
      });
      response.end(companionHtml());
      return;
    }
    if (request.method === "GET" && relativePath === "/companion.js") {
      response.writeHead(200, secureHeaders("text/javascript; charset=utf-8"));
      response.end(loadScript());
      return;
    }

    const route = relativePath === STATE_PATH
      ? state
      : relativePath === COMMAND_PATH ? command : null;
    if (route === null) {
      response.writeHead(404, secureHeaders("text/plain; charset=utf-8"));
      response.end("not-found");
      return;
    }
    await dispatch(route, request, response, `${relativePath}${requestUrl.search}`);
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Companion server did not bind an IPv4 loopback port");
  }
  const apiBase = `http://127.0.0.1:${address.port}${prefix}`;
  return {
    apiBase,
    pageUrl: `${apiBase}/window?apiBase=${encodeURIComponent(apiBase)}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error: unknown) => error === undefined ? resolve() : reject(error));
    }),
  };
}

function companionHtml(): string {
  return "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">" +
    "<style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style>" +
    "<title>DSH 桌面老虎机</title></head><body><div id=\"root\"></div>" +
    "<script src=\"./companion.js\"></script></body></html>";
}

function secureHeaders(contentType: string): Record<string, string> {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

async function dispatch(
  route: HostWebRoute,
  request: any,
  response: any,
  url: string,
): Promise<void> {
  const adapted = {
    method: request.method,
    url,
    headers: request.headers,
    [Symbol.asyncIterator]: () => request[Symbol.asyncIterator](),
  };
  await route.handler(adapted, response);
}
