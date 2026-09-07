import { dayPhaseLabel, type DayPhase } from "../time/day-phase";

export interface DaylightStatusProps {
  phase: DayPhase;
  source?: "系统" | "庄园" | "预览";
}

export function DaylightStatus({ phase, source = "系统" }: DaylightStatusProps) {
  const label = dayPhaseLabel(phase);
  return (
    <p
      className="daylight-status"
      data-day-phase={phase}
      role="status"
      aria-live="polite"
      aria-label={`当前${source}光照：${label}`}
    >
      <span>光照</span>
      <strong>{label}</strong>
    </p>
  );
}
