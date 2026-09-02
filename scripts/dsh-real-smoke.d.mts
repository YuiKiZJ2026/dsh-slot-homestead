interface SmokeSnapshot {
  readonly revision: number;
  readonly wallet: number;
  readonly lastGrantedLocalDate: string | null;
}

export function parseDshWebUrl(output: string): string;
export function configHasPluginRow(
  config: string,
  pluginId: string,
  packageName?: string,
): boolean;
export function pluginEntryFromBootManifest(
  html: string,
  pluginId: string,
): { id: string; url: string; rev: string };
export function assertClientBundle(source: string, pluginId: string): void;
export function assertDifferentWebPort(firstUrl: string, restartedUrl: string): void;
export function assertGracefulSigintExit(outcome: {
  readonly code: number | null;
  readonly signal: string | null;
}, platform?: string): void;
export function createDshInvocation(
  command: string,
  entry?: string,
  nodeExecutable?: string,
): { readonly command: string; readonly prefixArgs: readonly string[] };
export function defaultPluginArchive(): string;
export function parseArguments(args: readonly string[]): {
  readonly dsh: string;
  readonly dshEntry?: string;
  readonly tgz: string;
  readonly upgradeFrom?: string;
};
export function assertClaimTransition(initial: SmokeSnapshot, claimed: SmokeSnapshot): void;
export function assertPersistedSnapshot(
  expected: SmokeSnapshot,
  restarted: SmokeSnapshot,
): void;
