import { describe, expect, it } from "vitest";
import { acquireWriterLock } from "./writer-lock";

type LockOptions = { mode: "exclusive"; ifAvailable: true };
type LockCallback<T> = (lock: object | null) => Promise<T> | T;

class FakeLockManager {
  locked = false;
  readonly requests: Array<{ name: string; options: LockOptions }> = [];
  private readonly inFlight = new Set<Promise<unknown>>();

  request<T>(name: string, options: LockOptions, callback: LockCallback<T>): Promise<T> {
    this.requests.push({ name, options });

    if (this.locked) {
      return Promise.resolve(callback(null));
    }

    this.locked = true;
    const request = Promise.resolve(callback({ name })).finally(() => {
      this.locked = false;
    });
    this.inFlight.add(request);
    void request.finally(() => this.inFlight.delete(request)).catch(() => undefined);
    return request;
  }

  async waitUntilIdle() {
    await Promise.all([...this.inFlight]);
  }
}

describe("writer lock", () => {
  it("holds the named exclusive writer lease until release", async () => {
    const locks = new FakeLockManager();
    const modes: string[] = [];

    const lease = await acquireWriterLock(locks, (mode) => modes.push(mode));

    expect(lease.mode).toBe("writer");
    expect(modes).toEqual(["writer"]);
    expect(locks.locked).toBe(true);
    expect(locks.requests).toEqual([
      { name: "dsh-slot-economy", options: { mode: "exclusive", ifAvailable: true } },
    ]);

    lease.release();
    await locks.waitUntilIdle();
    expect(locks.locked).toBe(false);
  });

  it("reports readonly when the exclusive lock is unavailable", async () => {
    const locks = new FakeLockManager();
    const writer = await acquireWriterLock(locks, () => undefined);
    const modes: string[] = [];

    const readonly = await acquireWriterLock(locks, (mode) => modes.push(mode));

    expect(readonly.mode).toBe("readonly");
    expect(modes).toEqual(["readonly"]);
    expect(locks.locked).toBe(true);
    readonly.release();
    writer.release();
    await locks.waitUntilIdle();
  });

  it("allows a new writer only after the held lease is released", async () => {
    const locks = new FakeLockManager();
    const first = await acquireWriterLock(locks, () => undefined);
    first.release();
    await locks.waitUntilIdle();

    const second = await acquireWriterLock(locks, () => undefined);

    expect(second.mode).toBe("writer");
    second.release();
    await locks.waitUntilIdle();
  });

  it("reports unsupported mode without requesting or holding a lock", async () => {
    const modes: string[] = [];

    const lease = await acquireWriterLock(undefined, (mode) => modes.push(mode));

    expect(lease.mode).toBe("unsupported");
    expect(modes).toEqual(["unsupported"]);
    expect(() => lease.release()).not.toThrow();
  });

  it("rejects promptly when the lock request rejects before entering its callback", async () => {
    const failure = new Error("Web Locks request failed");
    const locks = {
      request: async <T>(
        _name: string,
        _options: LockOptions,
        _callback: LockCallback<T>,
      ): Promise<T> => Promise.reject(failure),
    };

    await expect(acquireWriterLock(locks, () => undefined)).rejects.toBe(failure);
  });

  it("does not leak an unhandled rejection if the held request fails after release", async () => {
    const failure = new Error("request failed after callback");
    let reportCallbackReturned!: () => void;
    const callbackReturned = new Promise<void>((resolve) => { reportCallbackReturned = resolve; });
    const locks = {
      request: async <T>(
        _name: string,
        _options: LockOptions,
        callback: LockCallback<T>,
      ): Promise<T> => {
        await callback({});
        reportCallbackReturned();
        throw failure;
      },
    };
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    try {
      const lease = await acquireWriterLock(locks, () => undefined);
      lease.release();
      await callbackReturned;
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(unhandled).toEqual([]);
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });
});
