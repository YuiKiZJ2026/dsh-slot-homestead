import { createInitialState, type GameState } from "../domain/types";
import { parseGameState } from "./schema";

export const STATE_KEY = "dsh-slot-state";

export class RevisionConflictError extends Error {
  constructor(expectedRevision: number, actualRevision: number) {
    super(`Expected revision ${expectedRevision}, but current revision is ${actualRevision}`);
    this.name = "RevisionConflictError";
  }
}

export class StorageWriteError extends Error {
  constructor(cause: unknown) {
    super("Unable to persist the game state", { cause });
    this.name = "StorageWriteError";
  }
}

export class StateRepository {
  constructor(
    private readonly storage: Storage,
    private readonly nowIso = () => new Date().toISOString(),
  ) {}

  load(): GameState {
    const raw = this.storage.getItem(STATE_KEY);
    if (raw === null) {
      return createInitialState();
    }

    try {
      return parseStoredState(raw);
    } catch {
      this.backUpCorruptSnapshot(raw);
      this.discardCorruptSnapshot();
      return createInitialState();
    }
  }

  save(next: GameState, expectedRevision: number): GameState {
    const raw = this.storage.getItem(STATE_KEY);
    const current = raw === null ? createInitialState() : parseStoredState(raw);

    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(expectedRevision, current.revision);
    }

    const saved = parseGameState({ ...next, revision: expectedRevision + 1 });
    const serialized = JSON.stringify(saved);

    try {
      this.storage.setItem(STATE_KEY, serialized);
    } catch (cause) {
      throw new StorageWriteError(cause);
    }

    return saved;
  }

  private backUpCorruptSnapshot(raw: string): void {
    try {
      this.storage.setItem(`dsh-slot-corrupt-${this.nowIso()}`, raw);
    } catch {
      // Recovery must remain available even when storage is full or unavailable.
    }
  }

  private discardCorruptSnapshot(): void {
    try {
      this.storage.removeItem(STATE_KEY);
    } catch {
      // A recovered in-memory state is still preferable when storage is unavailable.
    }
  }
}

function parseStoredState(raw: string): GameState {
  return parseGameState(JSON.parse(raw));
}
