export interface RandomSource {
  next(): number;
}

export const mathRandomSource: RandomSource = { next: () => Math.random() };

export function stableVerificationRoll(eventId: string): number {
  let hash = 0x811c9dc5;

  for (const char of `dsh-verify-v1:${eventId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) / 0x1_0000_0000;
}
