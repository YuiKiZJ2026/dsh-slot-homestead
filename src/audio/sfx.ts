export type SfxKind = "coin" | "lever" | "reel-stop" | "payout" | "rare";

interface CueDefinition {
  frequency: number;
  endFrequency: number;
  gain: number;
  duration: number;
  type: OscillatorType;
}

const CUES: Readonly<Record<SfxKind, CueDefinition>> = {
  coin: { frequency: 880, endFrequency: 1_120, gain: 0.035, duration: 0.09, type: "square" },
  lever: { frequency: 190, endFrequency: 110, gain: 0.028, duration: 0.14, type: "sawtooth" },
  "reel-stop": { frequency: 330, endFrequency: 260, gain: 0.025, duration: 0.07, type: "square" },
  payout: { frequency: 660, endFrequency: 990, gain: 0.035, duration: 0.16, type: "triangle" },
  rare: { frequency: 990, endFrequency: 1_480, gain: 0.03, duration: 0.17, type: "sine" },
};

let sharedContext: AudioContext | null = null;

export function playSfx(kind: SfxKind, muted: boolean): void {
  if (muted || prefersReducedMotion()) return;

  const context = getAudioContext();
  if (context === null) return;

  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }

  const cue = CUES[kind];
  const now = context.currentTime;
  const end = now + cue.duration;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = cue.type;
  oscillator.frequency.setValueAtTime(cue.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(cue.endFrequency, end);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(cue.gain, now + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(end);
}

function getAudioContext(): AudioContext | null {
  if (sharedContext !== null) return sharedContext;
  const AudioContextConstructor = globalThis.AudioContext;
  if (AudioContextConstructor === undefined) return null;

  try {
    sharedContext = new AudioContextConstructor();
    return sharedContext;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  return typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
