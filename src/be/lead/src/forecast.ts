export type Forecast = { projectedDate: string | null; risk: "ON_TRACK" | "AT_RISK" | "UNKNOWN" };

const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" });

export function singaporeDate(value: Date): string {
  const parts = Object.fromEntries(dateParts.formatToParts(value).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function projectCompletion(asOf: string, pointsRemaining: number, avgVelocity: number | null, averageSprintDays: number | null): string | null {
  if (avgVelocity == null || avgVelocity === 0 || averageSprintDays == null) return null;
  return addDays(asOf, Math.ceil(pointsRemaining / avgVelocity) * averageSprintDays);
}

export function forecast(asOf: string, targetDate: string, pointsRemaining: number, avgVelocity: number | null, averageSprintDays: number | null): Forecast {
  const projectedDate = projectCompletion(asOf, pointsRemaining, avgVelocity, averageSprintDays);
  return { projectedDate, risk: projectedDate == null ? "UNKNOWN" : projectedDate > targetDate ? "AT_RISK" : "ON_TRACK" };
}
