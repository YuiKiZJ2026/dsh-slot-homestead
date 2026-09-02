import type { DateKey } from "../domain/types";

export interface Clock {
  now(): Date;
}

export interface AdjustableClock extends Clock {
  set(value: Date): void;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private value: Date) {}

  now(): Date {
    return new Date(this.value);
  }

  set(value: Date): void {
    this.value = new Date(value);
  }
}

export class OffsetSystemClock implements AdjustableClock {
  private offsetMs = 0;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  set(value: Date): void {
    this.offsetMs = value.getTime() - Date.now();
  }
}

export function localDateKey(value: Date | string): DateKey {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}` as DateKey;
}
