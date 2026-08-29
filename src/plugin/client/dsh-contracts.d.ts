declare module "@deepseek-ai/dsh-client-runtime/client" {
  import type { ComponentType } from "react";

  export interface ClientContext {
    readonly slots: {
      inject(name: "shell.overlay", factory: () => () => void): void;
      register(
        definition: {
          readonly name: "shell.overlay";
          readonly id: string;
          readonly order: number;
        },
        component: ComponentType,
      ): () => void;
    };
  }
}

declare module "*.png" {
  const url: string;
  export default url;
}
