export function developmentOutcomeOverridesEnabled(
  runtimeDev: boolean,
  requested: boolean,
): boolean {
  return runtimeDev && requested;
}
