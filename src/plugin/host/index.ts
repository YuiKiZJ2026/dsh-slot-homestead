import type { Context } from "@deepseek-ai/cordis";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import type {} from "@deepseek-ai/dsh-host-webserver";
import type {} from "@deepseek-ai/dsh-session";
import { hostStateSchema } from "../shared/contracts";
import { createInitialHostState, type GameDomain } from "./domain";
import { GameService } from "./game-service";
import { commandRoute, stateRoute } from "./http";

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
  const disposers: Array<() => void> = [];
  let disposed: Promise<void> | null = null;
  const dispose = (): Promise<void> => {
    if (disposed !== null) return disposed;
    disposed = (async () => {
      for (const off of disposers.splice(0).reverse()) off();
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
  } catch (cause) {
    await dispose();
    throw diagnostic(
      "Host setup",
      "verify exact route availability and persisted dsh_slot_widget data",
      cause,
    );
  }
}

function diagnostic(stage: string, remedy: string, cause: unknown): Error {
  return new Error(`dsh-slot-widget ${stage} failed; ${remedy}`, { cause });
}
