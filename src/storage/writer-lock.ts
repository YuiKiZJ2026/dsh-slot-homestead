export type WriterMode = "writer" | "readonly" | "unsupported";

export type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: object | null) => Promise<T> | T,
  ): Promise<T>;
};

export async function acquireWriterLock(
  locks: LockManagerLike | undefined,
  onMode: (mode: WriterMode) => void,
) {
  if (locks === undefined) {
    onMode("unsupported");
    return { mode: "unsupported" as const, release: () => undefined };
  }

  let releaseHold!: () => void;
  const hold = new Promise<void>((resolve) => { releaseHold = resolve; });
  let reportEntered!: (mode: "writer" | "readonly") => void;
  let reportRequestFailure!: (error: unknown) => void;
  const entered = new Promise<"writer" | "readonly">((resolve, reject) => {
    reportEntered = resolve;
    reportRequestFailure = reject;
  });
  let callbackEntered = false;

  const requestPromise = Promise.resolve().then(() => locks.request(
    "dsh-slot-economy",
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      const mode = lock === null ? "readonly" : "writer";
      onMode(mode);
      callbackEntered = true;
      reportEntered(mode);

      if (lock !== null) {
        await hold;
      }
    },
  ));

  void requestPromise.catch((error: unknown) => {
    if (!callbackEntered) {
      reportRequestFailure(error);
    }
  });

  const mode = await entered;
  return {
    mode,
    release: () => {
      releaseHold();
    },
  };
}
