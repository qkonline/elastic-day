// What the worker accepts from the app.

/** How far ahead a push can be booked. Timers and heads-ups are for today; this is plenty. */
const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;
/** How many pushes one browser can have booked at once. */
const MAX_TIMES = 20;

/** The browsers' own push services. Anything else is refused. */
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

export function isPushEndpoint(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 1024) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

export function isBookableTime(v: unknown, now = Date.now()): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > now - 60_000 && v < now + MAX_AHEAD_MS;
}

/**
 * The times to ring at, earliest first: one time, or a list of them (the app books its
 * time's-up and heads-ups together). Null if anything in it isn't bookable.
 */
export function bookableTimes(v: unknown, now = Date.now()): number[] | null {
  const list = Array.isArray(v) ? v : [v];
  if (!list.length || list.length > MAX_TIMES || !list.every((t) => isBookableTime(t, now))) return null;
  return [...new Set(list as number[])].sort((a, b) => a - b);
}
