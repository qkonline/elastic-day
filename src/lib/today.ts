// Which day counts as "Today". A day that has been started stays Today after midnight until
// it's ended ("End my day"), so a late night belongs to the day it started on. If it's never
// ended, it closes at 4 am, or three hours after its planned wrap-up when that's later, and
// never past noon the next day. A timer still running then shows as running on another day.

import { addDays, minutesInto } from './time';
import type { Day } from './types';

/** How long after the planned wrap-up an un-ended day still counts as Today (minutes). */
export const GRACE = 180;
/** An un-ended day stays Today until at least 4 am (minutes after its own midnight). */
export const EARLIEST = 1440 + 240;
/** A day never stays open past noon the next day. */
export const HARD_LIMIT = 1440 + 720;

/** The minute (from the day's midnight) at which an un-ended, started day stops being Today. */
export function dayCutoff(d: Day): number {
  return Math.min(HARD_LIMIT, Math.max(EARLIEST, d.wrap + GRACE));
}

/** Today's key: yesterday while it's still going, otherwise the calendar date. */
export function activeDayKey(calendarToday: string, days: Record<string, Day>, nowMs: number): string {
  const prev = addDays(calendarToday, -1);
  const d = days[prev];
  if (!d || d.dayStarted == null || d.dayEnded != null) return calendarToday;
  return minutesInto(prev, nowMs) < dayCutoff(d) ? prev : calendarToday;
}
