import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [mediaQuery] = useState<MediaQueryList | null>(() => (
    typeof globalThis.matchMedia === "function"
      ? globalThis.matchMedia(REDUCED_MOTION_QUERY)
      : null
  ));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    mediaQuery?.matches ?? false,
  );

  useEffect(() => {
    if (mediaQuery === null) return undefined;

    const onChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [mediaQuery]);

  return prefersReducedMotion;
}
