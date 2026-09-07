export type DayPhase = "dawn" | "day" | "dusk" | "night";

const DAY_PHASE_LABELS: Readonly<Record<DayPhase, string>> = {
  dawn: "清晨微光",
  day: "日间明亮",
  dusk: "傍晚暖光",
  night: "夜间熄灯",
};

export function resolveDayPhase(value: Date): DayPhase {
  return resolveDayPhaseAtHour(value.getHours());
}

export function resolveDayPhaseAtHour(hour: number): DayPhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export function dayPhaseLabel(phase: DayPhase): string {
  return DAY_PHASE_LABELS[phase];
}
