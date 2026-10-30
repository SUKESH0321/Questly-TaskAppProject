/** How long we look for a tasker before the task expires. 0 = no timer. */
export const SEARCH_WINDOWS = [
  { minutes: 15, label: "15 min", hint: "Urgent" },
  { minutes: 30, label: "30 min", hint: "Quick" },
  { minutes: 60, label: "1 hour", hint: "" },
  { minutes: 180, label: "3 hours", hint: "" },
  { minutes: 1440, label: "24 hours", hint: "Relaxed" },
  { minutes: 0, label: "No limit", hint: "Stay open" },
] as const;

export const DEFAULT_SEARCH_MINUTES = 30;

/** Extra (INR) a poster can add for a fast pickup. Only offered with the 15 and 30 minute windows. */
export const URGENCY_BONUSES = [10, 25, 50, 75] as const;
export const URGENT_MINUTES: readonly number[] = [15, 30];
export const isUrgentWindow = (minutes: number) => URGENT_MINUTES.includes(minutes);

export function searchWindowLabel(minutes: number): string {
  return SEARCH_WINDOWS.find((w) => w.minutes === minutes)?.label ?? `${minutes} min`;
}
