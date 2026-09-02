import { dayPhaseLabel, type DayPhase } from "../time/day-phase";

export interface DaylightStatusProps {
  phase: DayPhase;
}

export function DaylightStatus({ phase }: DaylightStatusProps) {
  const label = dayPhaseLabel(phase);
  return (
    <p
      className="daylight-status"
      data-day-phase={phase}
      role="status"
      aria-live="polite"
      aria-label={`当前系统光照：${label}`}
    >
      <span>光照</span>
      <strong>{label}</strong>
    </p>
  );
}
