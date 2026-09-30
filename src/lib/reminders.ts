// Heads-ups before fixed-time tasks, and the alerts the push worker rings for while the app is
// in the background. The page writes those alerts to IndexedDB when it goes into the
// background and books one push per group; src/sw.js shows each group when its push arrives.

import { atMinutes } from './time';
import type { Day, Item } from './types';

/** A fixed-time task that's coming up. Times are epoch ms. */
export interface HeadsUp {
  /** Stays the same when an unsaved day is rebuilt (its tasks get new ids). */
  tag: string;
  it: Item;
  /** When to give the heads-up. */
  at: number;
  /** When the task is due to start. */
  startsAt: number;
}

/** Heads-ups for the fixed-time tasks still to do on these days, `lead` minutes before each. */
export function headsUps(days: Day[], lead: number): HeadsUp[] {
  if (!(lead > 0)) return [];
  const out: HeadsUp[] = [];
  for (const d of days) {
    // Nothing left to remind about once a day has ended.
    if (d.dayEnded != null) continue;
    for (const it of d.items) {
      if (it.kind !== 'fixed' || it.status !== 'todo' || it.fixedAt == null) continue;
      const startsAt = atMinutes(d.key, it.fixedAt);
      out.push({ tag: `fixed-${d.key}-${it.seriesId ?? it.id}`, it, at: startsAt - lead * 60000, startsAt });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export interface Note {
  title: string;
  body: string;
  tag: string;
}

/** Notifications that share one push. `shown` is set by the service worker. */
export interface AlertGroup {
  at: number;
  notes: Note[];
  shown?: boolean;
}

/** Alerts closer together than this share a push. */
export const SAME_PUSH_MS = 90_000;
/** The worker books at most a day ahead. */
const AHEAD_MS = 23 * 3600_000;
export const MAX_PUSHES = 20;

/** The pushes to book: alerts still ahead, in time order, close ones grouped. */
export function pushPlan(alerts: { at: number; note: Note }[], now: number): AlertGroup[] {
  const groups: AlertGroup[] = [];
  const ahead = alerts.filter((a) => a.at > now && a.at < now + AHEAD_MS).sort((a, b) => a.at - b.at);
  for (const a of ahead) {
    const last = groups[groups.length - 1];
    if (last && a.at - last.at < SAME_PUSH_MS) last.notes.push(a.note);
    else groups.push({ at: a.at, notes: [a.note] });
  }
  return groups.slice(0, MAX_PUSHES);
}
