// What the worker accepts from the app.

/** How far ahead a push can be booked. Timers are for today; this is plenty. */
const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;

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
