const ZONE = "Asia/Singapore";

function singaporeDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekday(date: string): number { return new Date(`${date}T00:00:00Z`).getUTCDay(); }

export function defaultStandupDate(now: Date): string { return singaporeDate(now); }

export function acceptedStandupDates(now: Date): string[] {
  const today = singaporeDate(now);
  const day = weekday(today);
  const next = day === 5 ? addDays(today, 3) : day === 6 ? addDays(today, 2) : day === 0 ? addDays(today, 1) : addDays(today, 1);
  return [today, next];
}

export function isValidStandupDate(value: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return false;
  return acceptedStandupDates(now).includes(value);
}

export function assertValidStandupDate(value: string | undefined, now: Date): string {
  const selected = value ?? defaultStandupDate(now);
  if (!isValidStandupDate(selected, now)) throw new Error("VALIDATION_FAILED");
  return selected;
}

export function standupActivityWindow(now: Date): { from: Date; to: Date } {
  const today = singaporeDate(now);
  let cursor = addDays(today, -1);
  while (weekday(cursor) === 0 || weekday(cursor) === 6) cursor = addDays(cursor, -1);
  return { from: new Date(`${cursor}T00:00:00+08:00`), to: now };
}
