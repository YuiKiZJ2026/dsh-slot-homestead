import { useEffect, useState } from "react";
import type { Clock } from "./clock";
import { resolveDayPhase, type DayPhase } from "./day-phase";

const DAY_PHASE_REFRESH_MS = 60_000;

export function useDayPhase(clock: Clock): DayPhase {
  const [phase, setPhase] = useState<DayPhase>(() => resolveDayPhase(clock.now()));

  useEffect(() => {
    const refresh = (): void => setPhase(resolveDayPhase(clock.now()));
    refresh();
    const timer = window.setInterval(refresh, DAY_PHASE_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [clock]);

  return phase;
}
