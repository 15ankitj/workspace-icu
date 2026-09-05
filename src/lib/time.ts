/** Relative and absolute time formatting, en-GB, pure for testing. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diff / DAY);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  return formatDate(iso);
}

/** Compact form for tight spaces: 2m, 3h, 4d, 2w, else the date. */
export function formatRelativeShort(
  iso: string,
  now: number = Date.now(),
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  const d = Math.floor(diff / DAY);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A property date value: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, en-GB. */
export function formatPropertyDate(value: string): string {
  const hasTime = value.includes("T");
  const date = new Date(hasTime ? value : `${value}T00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return hasTime
    ? formatDateTime(date.toISOString())
    : formatDate(date.toISOString());
}
