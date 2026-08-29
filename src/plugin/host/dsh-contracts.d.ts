declare module "@deepseek-ai/dsh-storage-domain" {
  interface DomainSpec {
    readonly name: string;
    readonly version: number;
    readonly global?: {
      readonly schema: { parse(input: unknown): unknown };
      readonly initial: unknown;
    };
    readonly tables: Record<string, unknown>;
  }

  export function defineDomain<const Spec extends DomainSpec>(spec: Spec): Spec;
}

declare module "@deepseek-ai/dsh-session" {}
declare module "@deepseek-ai/dsh-host-webserver" {}

declare module "@deepseek-ai/cordis" {
  export interface Context {
    readonly storageDomain: {
      open(spec: unknown): Promise<import("./domain").GameDomain>;
    };
    readonly sessions: {
      list(): import("./session-usage").SessionLike[];
    };
    readonly webServer: {
      readonly port: number;
      register(route: import("./http").HostWebRoute): () => void;
    };
    readonly logger: {
      error(error: unknown): void;
    };
    on(
      event: "session/event",
      listener: (
        session: import("./session-usage").SessionLike,
        event: import("./session-usage").SessionEventLike,
      ) => void,
    ): () => void;
    on(
      event: "agent/status",
      listener: (payload: {
        agent: {
          id: string;
          session: import("./session-usage").SessionLike;
        };
        status: "idle" | "running";
      }) => void,
    ): () => void;
    effect(
      setup: () => void | (() => void | Promise<void>),
      label?: string,
    ): void;
  }
}

declare module "electron" {
  export const BrowserWindow: unknown;
  export const app: unknown;
  export const screen: unknown;
}
