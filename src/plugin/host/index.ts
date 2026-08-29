// @ts-expect-error Node built-ins are available in the DSH Host runtime.
import { readFileSync } from "node:fs";
import type { Context } from "@deepseek-ai/cordis";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import type {} from "@deepseek-ai/dsh-host-webserver";
import type {} from "@deepseek-ai/dsh-session";
import { hostStateSchema } from "../shared/contracts";
import { createInitialHostState, type GameDomain } from "./domain";
import { GameService } from "./game-service";
import {
  commandRoute,
  companionRoute,
  companionScriptRoute,
  companionWindowRoute,
  stateRoute,
} from "./http";
import { createCompanionWindow } from "./companion-window";
import { startCompanionServer } from "./companion-server";

export const inject = ["sessions", "storageDomain", "webServer"];

export const gameDomainSpec: ReturnType<typeof defineDomain> = defineDomain({
  name: "dsh_slot_widget",
  version: 1,
  global: {
    schema: hostStateSchema,
    initial: createInitialHostState(),
  },
  tables: {},
});

export async function apply(ctx: Context): Promise<void> {
  let domain: GameDomain;
  try {
    domain = await ctx.storageDomain.open(gameDomainSpec);
  } catch (cause) {
    throw diagnostic(
      "storage open",
      "verify that storageDomain has a valid backend route for dsh_slot_widget",
      cause,
    );
  }

  const service = new GameService(domain);
  let companionStatus: "starting" | "active" | "unavailable" = "starting";
  const disposers: Array<() => void | Promise<void>> = [];
  let disposed: Promise<void> | null = null;
  const dispose = (): Promise<void> => {
    if (disposed !== null) return disposed;
    disposed = (async () => {
      for (const off of disposers.splice(0).reverse()) await off();
      await service.dispose();
      await domain.close();
    })();
    return disposed;
  };

  try {
    ctx.effect(() => {
      try {
        disposers.push(ctx.on("session/event", (session, event) => {
          void service.acceptSessionEvent(session, event).catch((error: unknown) => {
            ctx.logger.error(diagnostic("session usage write", "storage write was rejected", error));
          });
        }));
        disposers.push(ctx.on("agent/status", ({ agent, status }) => {
          service.acceptAgentStatus(agent.session.id, agent.id, status);
        }));
        disposers.push(ctx.webServer.register(stateRoute(service)));
        disposers.push(ctx.webServer.register(commandRoute(service)));
        disposers.push(ctx.webServer.register(companionRoute(() => companionStatus)));
        disposers.push(ctx.webServer.register(companionWindowRoute()));
        disposers.push(ctx.webServer.register(companionScriptRoute(loadCompanionScript)));
      } catch (cause) {
        for (const off of disposers.splice(0).reverse()) off();
        throw cause;
      }
      return dispose;
    }, "dsh-slot-widget host");

    // The listener is installed before replay so a live append cannot fall into
    // the scan gap. Live aggregates stay buffered until every session history
    // has replayed in sequence order.
    await Promise.all(ctx.sessions.list().map((session) => service.adoptSession(session)));
    await service.completeUsageBootstrap();
    try {
      const companionServer = await startCompanionServer(service, loadCompanionScript);
      disposers.push(() => companionServer.close());
      const companionSnapshot = await service.getSnapshot("dsh-slot-widget-global");
      const companion = await createCompanionWindow({
        apiBase: companionServer.apiBase,
        pageUrl: companionServer.pageUrl,
        initialScale: companionSnapshot.settings.companionScale,
      });
      companionStatus = companion === null ? "unavailable" : "active";
      if (companion !== null) disposers.push(() => {
        companionStatus = "unavailable";
        companion.dispose();
      });
    } catch (error) {
      companionStatus = "unavailable";
      ctx.logger.error(diagnostic(
        "desktop companion window",
        "the in-app fallback remains available; verify the Electron BrowserWindow runtime",
        error,
      ));
    }
  } catch (cause) {
    await dispose();
    throw diagnostic(
      "Host setup",
      "verify exact route availability and persisted dsh_slot_widget data",
      cause,
    );
  }
}

function loadCompanionScript(): string {
  return readFileSync(new URL(/* @vite-ignore */ "./companion.js", import.meta.url), "utf8");
}

function diagnostic(stage: string, remedy: string, cause: unknown): Error {
  return new Error(`dsh-slot-widget ${stage} failed; ${remedy}`, { cause });
}
