/** "4 MIN AGO" / "2 HR AGO" — used by every freshness line (BUILD.md
 * non-negotiable: every stat carries a reachable freshness timestamp). */
export function formatRelativeTime(input: Date | string, now: Date = new Date()): string {
  const then = typeof input === 'string' ? new Date(input) : input;
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return 'JUST NOW';
  if (minutes === 1) return '1 MIN AGO';
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return '1 HR AGO';
  if (hours < 24) return `${hours} HR AGO`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 DAY AGO' : `${days} DAYS AGO`;
}

/** "14 Sep – 21 Dec 2026" — season date ranges. */
export function formatDateRange(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '';
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = (d: Date) => d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  const withYear = (d: Date) => d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day(start)} – ${withYear(end)}`;
}

/** "2 Sep 09:14" — admin console timestamps (registration, scheduling). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** mm:ss for countdowns — hh:mm:ss once an hour or more remains. */
export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
