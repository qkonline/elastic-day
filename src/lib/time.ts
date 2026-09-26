const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const pad = (x: number) => String(x).padStart(2, '0');

/** "09:30" → 570 */
export function hm(s: string): number {
  const [h, m] = String(s || '0:0')
    .split(':')
    .map(Number);
  return h * 60 + (m || 0);
}

/** 570 → "09:30" (for <input type="time">) */
export function hhmm(m: number): string {
  m = Math.floor(m);
  return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
}

const parts = (m: number) => {
  m = Math.floor(m + 1e-6);
  return { h: Math.floor(m / 60) % 24, mm: m % 60 };
};

/** Full time: "9:30 am" or "09:30". */
export function fT(m: number, clock24: boolean): string {
  const { h, mm } = parts(m);
  if (clock24) return pad(h) + ':' + pad(mm);
  return ((h + 11) % 12) + 1 + ':' + pad(mm) + ' ' + (h < 12 ? 'am' : 'pm');
}

/** Time without the am/pm suffix: "9:30" or "09:30". */
export function fTs(m: number, clock24: boolean): string {
  const { h, mm } = parts(m);
  return clock24 ? pad(h) + ':' + pad(mm) : ((h + 11) % 12) + 1 + ':' + pad(mm);
}

/** The am/pm suffix on its own, or null in 24-hour mode. */
export function apOf(m: number, clock24: boolean): string | null {
  if (clock24) return null;
  return parts(m).h < 12 ? 'am' : 'pm';
}

/** No leading zero: "9:12 am" / "9:12". */
export function fNZ(m: number, clock24: boolean): string {
  const { h, mm } = parts(m);
  return clock24 ? h + ':' + pad(mm) : fT(m, false);
}

/** Duration: 50 → "50m", 90 → "1h 30m", 120 → "2h". */
export function dL(min: number): string {
  const t = Math.max(0, Math.round(min));
  const h = Math.floor(t / 60),
    m = t % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Countdown: "mm:ss" or "h:mm:ss". */
export function cd(sec: number): string {
  sec = Math.floor(Math.abs(sec));
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function dkey(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export const todayKey = () => dkey(new Date());

export function keyDate(k: string): Date {
  const [Y, M, D] = k.split('-').map(Number);
  return new Date(Y, M - 1, D);
}

export function addDays(k: string, n: number): string {
  const d = keyDate(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
}

/** The Monday of the week that `k` falls in (weeks run Monday to Sunday). */
export function mondayOf(k: string): string {
  return addDays(k, -((keyDate(k).getDay() + 6) % 7));
}

/** Whole days from `a` to `b`. */
export function dayDiff(a: string, b: string): number {
  return Math.round((keyDate(b).getTime() - keyDate(a).getTime()) / 86400000);
}

/**
 * Wall-clock minutes since the start of day `key` (can be negative or > 1440). On days when
 * the clocks change, elapsed time and the clock differ by an hour; this follows the clock so
 * planned times and the now line line up with what the user's watch says.
 */
export function minutesInto(key: string, nowMs = Date.now()): number {
  const midnight = keyDate(key);
  const shift = midnight.getTimezoneOffset() - new Date(nowMs).getTimezoneOffset();
  return (nowMs - midnight.getTime()) / 60000 + shift;
}

/** "Fri 25 Sep" */
export function shortDate(d: Date): string {
  return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
}

export const weekdayShort = (d: Date) => WD[d.getDay()];
export const weekdayLong = (d: Date) => WD_LONG[d.getDay()];
export const monthShort = (d: Date) => MON[d.getMonth()];

export function longDate(d: Date): string {
  return `${WD_LONG[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
}
