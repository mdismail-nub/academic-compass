/** Day-of-week helpers. 0 = Sunday, matching JS Date#getDay() and the DB column. */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Academic week order used across the app (Sunday-first, Bangladeshi week). */
export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? "—";
}

export function todayIndex(now: Date = new Date()): number {
  return now.getDay();
}

/** "09:30:00" -> "09:30 AM" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [hStr, mStr] = value.split(":");
  const hours = Number(hStr);
  const minutes = mStr ?? "00";
  if (Number.isNaN(hours)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(display).padStart(2, "0")}:${minutes} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Minutes since midnight, for sorting and "next class" logic. */
export function toMinutes(value: string): number {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
