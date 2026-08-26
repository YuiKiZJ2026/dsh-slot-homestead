export function sourceArchivePaths(version: string): {
  readonly archiveName: string;
  readonly prefix: string;
};
export function sourceArchiveArguments(
  commit: string,
  prefix: string,
  output: string,
  includedPaths: readonly string[],
): string[];
export function validateTrackedPaths(paths: readonly string[]): string[];
export function validateArchiveEntries(
  entries: readonly string[],
  includedPaths: readonly string[],
  prefix: string,
): void;
