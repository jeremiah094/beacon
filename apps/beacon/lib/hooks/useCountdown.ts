import { useEffect, useState } from 'react';
import { formatCountdown } from '../time';

/** Ticking mm:ss (or hh:mm:ss) label to a target time — for inline countdowns
 * that aren't the big hero Countdown component (e.g. a lock warning inside
 * a list row). Returns null once the target has passed. */
export function useCountdownLabel(target: Date | string | null): string | null {
  const targetMs = target ? (typeof target === 'string' ? new Date(target).getTime() : target.getTime()) : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) return null;
  const remaining = targetMs - now;
  if (remaining <= 0) return null;
  return formatCountdown(remaining);
}
