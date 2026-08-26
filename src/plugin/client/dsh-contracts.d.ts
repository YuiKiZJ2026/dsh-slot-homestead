declare module "@deepseek-ai/dsh-client-ui-conversation/client" {
  export interface ConvViewProps {
    readonly sessionId: string;
  }
}

declare module "@deepseek-ai/dsh-client-runtime/client" {
  import type { ComponentType } from "react";
  import type { ConvViewProps } from "@deepseek-ai/dsh-client-ui-conversation/client";

  export interface ClientContext {
    readonly slots: {
      inject(name: "conversation.view", factory: () => () => void): void;
      register(
        definition: {
          readonly name: "conversation.view";
          readonly id: string;
          readonly label: string;
          readonly order: number;
        },
        component: ComponentType<ConvViewProps>,
      ): () => void;
    };
  }
}

declare module "*.png" {
  const url: string;
  export default url;
}
