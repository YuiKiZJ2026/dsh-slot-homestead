import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("playSfx", () => {
  it("does not initialize Web Audio while muted or reduced motion is active", async () => {
    const AudioContext = vi.fn();
    vi.stubGlobal("AudioContext", AudioContext);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const { playSfx } = await import("./sfx");

    playSfx("coin", true);
    playSfx("coin", false);

    expect(AudioContext).not.toHaveBeenCalled();
  });

  it.each(["coin", "lever", "reel-stop", "payout", "rare"] as const)(
    "creates one short oscillator and gain envelope for %s",
    async (kind) => {
      const stop = vi.fn();
      const createOscillator = vi.fn(() => ({
        type: "square",
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop,
      }));
      const createGain = vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }));
      class AudioContextDouble {
        currentTime = 10;
        state: AudioContextState = "running";
        destination = {} as AudioDestinationNode;
        createOscillator = createOscillator;
        createGain = createGain;
        resume = vi.fn(() => Promise.resolve());
      }
      vi.stubGlobal("AudioContext", AudioContextDouble);
      vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
      const { playSfx } = await import("./sfx");

      playSfx(kind, false);

      expect(createOscillator).toHaveBeenCalledOnce();
      expect(createGain).toHaveBeenCalledOnce();
      expect(stop).toHaveBeenCalledOnce();
      expect(stop.mock.calls[0][0] - 10).toBeLessThan(0.18);
    },
  );
});
