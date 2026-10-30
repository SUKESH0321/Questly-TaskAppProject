/**
 * Formats an ISO timestamp as a short relative time ("Just now", "5m ago",
 * "3h ago", "2d ago", then a date). Non-date strings (e.g. older seeded
 * values like "2m ago") are returned unchanged.
 */
export function formatRelativeTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Clock time for chat bubbles, e.g. "2:15 PM". */
export function formatClockTime(value?: string, fallback = ""): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
