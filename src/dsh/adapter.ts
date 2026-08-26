import type { DshEvent } from "./events";

export interface DshAdapter {
  subscribe(listener: (event: DshEvent) => void): () => void;
}
