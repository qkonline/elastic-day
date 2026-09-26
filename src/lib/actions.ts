// Pure transformations of a Day. Each returns a new Day and never mutates its input.
// `n` is "now" in minutes since the day's local midnight.

import { isActive, schedule } from './schedule';
import type { Day, Item, Kind } from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export function newItem(o: Partial<Item> & { title: string }): Item {
  return {
    id: uid(),
    min: 30,
    kind: 'task',
    fixedAt: null,
    hue: 'cyan',
    status: 'todo',
    startedAt: null,
    endedAt: null,
    pausedAt: null,
    pausedFor: 0,
    repeat: 'Once',
    seriesId: null,
    subtasks: [],
    note: '',
    ...o,
  };
}

/** A fresh, unstarted copy for another day. Drops the repeat and history; unticks steps. */
export function freshCopy(it: Item, extra: Partial<Item> = {}): Item {
  return newItem({
    title: it.title,
    min: it.min,
    kind: it.kind,
    fixedAt: it.fixedAt,
    hue: it.hue,
    note: it.note,
    subtasks: it.subtasks.map((x) => ({ ...x, id: uid(), d: false })),
    ...extra,
  });
}

const mapItem = (day: Day, id: string, fn: (it: Item) => Partial<Item>): Day => ({
  ...day,
  items: day.items.map((i) => (i.id === id ? { ...i, ...fn(i) } : i)),
});

export const find = (day: Day, id: string) => day.items.find((i) => i.id === id);
export const activeItem = (day: Day) => day.items.find(isActive);

export function patchItem(day: Day, id: string, patch: Partial<Item>): Day {
  return mapItem(day, id, () => patch);
}

/**
 * Put the started item at the current point in the plan: straight after the last item that has
 * already happened (done, skipped, moved, or just finished), in front of everything still to do.
 * Whatever hasn't started is then planned after it, instead of overlapping it or being left
 * behind in slots that have already gone by.
 */
function toCurrentPoint(items: Item[], id: string): Item[] {
  const self = items.find((x) => x.id === id);
  if (!self) return items;
  const rest = items.filter((x) => x.id !== id);
  let at = 0;
  rest.forEach((x, k) => {
    if (x.kind !== 'check' && x.status !== 'todo') at = k + 1; // checks live in the checklist
  });
  rest.splice(at, 0, self);
  return rest;
}

/**
 * Starting an item finishes whatever else is running or paused as done, and moves the item to
 * the current point in the plan (see toCurrentPoint). Buffers never start.
 */
export function startItem(day: Day, id: string, n: number): Day {
  const target = find(day, id);
  if (!target || target.kind === 'buffer' || target.kind === 'check') return day;
  const items = day.items.map((i): Item => {
    if (i.id === id)
      return { ...i, status: 'running', startedAt: n, endedAt: null, pausedAt: null, pausedFor: 0, marked: false };
    if (i.status === 'running') return { ...i, status: 'done', endedAt: n };
    if (i.status === 'paused')
      return { ...i, status: 'done', pausedFor: pausedSoFar(i, n), pausedAt: null, endedAt: n };
    return i;
  });
  // Starting something on a day already ended reopens it.
  return { ...day, dayStarted: day.dayStarted ?? n, dayEnded: null, items: toCurrentPoint(items, id) };
}

/** "Start my day": stamp the day and start the first pending task (or fixed item). */
export function startDay(day: Day, n: number): Day {
  const timed = (i: Item) => i.status === 'todo' && i.kind !== 'buffer' && i.kind !== 'check';
  const first = day.items.find((i) => timed(i) && i.kind === 'task') ?? day.items.find(timed);
  const d = { ...day, dayStarted: n, dayEnded: null };
  return first ? startItem(d, first.id, n) : d;
}

/** Tick or untick a check (a task with no duration). */
export function toggleCheck(day: Day, id: string, n: number): Day {
  return mapItem(day, id, (i) =>
    i.kind !== 'check' ? {} : i.status === 'done' ? { status: 'todo', endedAt: null } : { status: 'done', endedAt: n },
  );
}

/** "End my day": finish whatever is running or paused, and mark the day as ended. */
export function endDay(day: Day, n: number): Day {
  const act = activeItem(day);
  const d = act ? finish(day, act.id, n) : day;
  return { ...d, dayEnded: n };
}

export function reopenDay(day: Day): Day {
  return { ...day, dayEnded: null };
}

export function pause(day: Day, id: string, n: number): Day {
  return mapItem(day, id, (i) => (i.status === 'running' ? { status: 'paused', pausedAt: n } : {}));
}

/** Time paused so far, banked when a paused item resumes or ends (never negative). */
const pausedSoFar = (i: Item, n: number) => i.pausedFor + Math.max(0, n - i.pausedAt!);

export function resume(day: Day, id: string, n: number): Day {
  return mapItem(day, id, (i) =>
    i.status === 'paused' ? { status: 'running', pausedFor: pausedSoFar(i, n), pausedAt: null } : {},
  );
}

export function finish(day: Day, id: string, n: number): Day {
  return mapItem(day, id, (i) => ({
    status: 'done',
    endedAt: n,
    pausedFor: i.status === 'paused' ? pausedSoFar(i, n) : i.pausedFor,
    pausedAt: null,
  }));
}

/** "Mark done" on a missed item: logged at its planned slot, flagged as never timed. */
export function markDone(day: Day, id: string, start: number, end: number): Day {
  return mapItem(day, id, () => ({
    status: 'done',
    startedAt: start,
    endedAt: end,
    pausedFor: 0,
    pausedAt: null,
    marked: true,
  }));
}

export function reopen(day: Day, id: string): Day {
  return mapItem(day, id, () => ({
    status: 'todo',
    startedAt: null,
    endedAt: null,
    pausedAt: null,
    pausedFor: 0,
    marked: false,
  }));
}

export const skip = (day: Day, id: string) => patchItem(day, id, { status: 'skipped' });

export function remove(day: Day, id: string): Day {
  return { ...day, items: day.items.filter((i) => i.id !== id) };
}

/** Swap with the neighbour: the task sheet's ↑ Earlier / ↓ Later. */
export function move(day: Day, id: string, d: -1 | 1): Day {
  const a = [...day.items];
  const i = a.findIndex((x) => x.id === id),
    j = i + d;
  if (i < 0 || j < 0 || j >= a.length) return day;
  [a[i], a[j]] = [a[j], a[i]];
  return { ...day, items: a };
}

/** Drop the dragged item before index `over` (items.length = the end). */
export function reorder(day: Day, id: string, over: number): Day {
  const a = [...day.items];
  const from = a.findIndex((i) => i.id === id);
  if (from < 0) return day;
  const [x] = a.splice(from, 1);
  let to = over;
  if (to > from) to--;
  a.splice(to, 0, x);
  return { ...day, items: a };
}

export function setKind(day: Day, id: string, k: Kind): Day {
  return mapItem(day, id, (i) => ({
    kind: k,
    fixedAt: k === 'fixed' && i.fixedAt == null ? day.dayStart : i.fixedAt,
    hue: k === 'fixed' && i.hue === 'cyan' ? 'indigo' : i.hue,
  }));
}

export function addItem(day: Day, it: Item): Day {
  return { ...day, items: [...day.items, it] };
}

/** Remaining minutes for a remainder copy (never less than 5). */
const remainder = (it: Item, w: number) => Math.max(5, Math.round(it.min - w));

/**
 * Postpone → Later today.
 * Not started: move to the end of the list.
 * Mid-task: the original becomes `postponed` (keeping its logged time) and a new item with
 * the remaining minutes is appended, badged "continued".
 */
export function postponeLater(day: Day, id: string, n: number): Day {
  const items = [...day.items];
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return day;
  const it = items[i];
  if (!isActive(it)) {
    items.splice(i, 1);
    items.push({ ...it, status: 'todo' });
    return { ...day, items };
  }
  const pf = it.status === 'paused' ? pausedSoFar(it, n) : it.pausedFor;
  const w = n - it.startedAt! - pf;
  items[i] = { ...it, status: 'postponed', endedAt: n, pausedFor: pf, pausedAt: null, laterCopy: true };
  items.push(
    newItem({
      title: it.title,
      min: remainder(it, w),
      hue: it.hue,
      kind: it.kind === 'fixed' ? 'task' : it.kind,
      note: it.note,
      subtasks: it.subtasks,
      continued: true,
    }),
  );
  return { ...day, items };
}

/**
 * Move an item to another day (Postpone → Tomorrow, Reschedule → Another day).
 * Returns the updated source day and the copy to append to the target day.
 * Mid-task, the source keeps its logged time and only the remaining minutes move.
 */
export function moveOut(day: Day, id: string, toKey: string, n: number): { day: Day; copy: Item } | null {
  const it = find(day, id);
  if (!it) return null;
  if (isActive(it)) {
    const pf = it.status === 'paused' ? pausedSoFar(it, n) : it.pausedFor;
    const w = n - it.startedAt! - pf;
    const copy = freshCopy(it, {
      min: remainder(it, w),
      kind: it.kind === 'fixed' ? 'task' : it.kind,
      continued: true,
    });
    copy.subtasks = it.subtasks.map((x) => ({ ...x }));
    return {
      day: mapItem(day, id, () => ({
        status: 'postponed',
        endedAt: n,
        pausedFor: pf,
        pausedAt: null,
        movedKey: toKey,
        movedId: copy.id,
      })),
      copy,
    };
  }
  const copy = freshCopy(it);
  return {
    day: mapItem(day, id, () => ({
      status: 'postponed',
      startedAt: null,
      endedAt: null,
      pausedAt: null,
      pausedFor: 0,
      movedKey: toKey,
      movedId: copy.id,
    })),
    copy,
  };
}

/** Undo a skip or a move. The caller removes the moved copy from its day. */
export function restore(day: Day, id: string): Day {
  return mapItem(day, id, () => ({ status: 'todo', movedKey: null, movedId: null }));
}

/**
 * Reschedule → Start now / Do it next.
 * With something running or paused, the item goes right after it ("do it next"). Otherwise the
 * caller starts it, and starting moves it to the current point in the plan.
 */
export function reschedNow(day: Day, id: string): { day: Day; start: boolean } {
  if (!find(day, id)) return { day, start: false };
  const act = activeItem(day);
  if (!act) return { day, start: true };
  const items = day.items.filter((i) => i.id !== id);
  items.splice(items.findIndex((i) => i.id === act.id) + 1, 0, find(day, id)!);
  return { day: { ...day, items }, start: false };
}

/** Reschedule → Later today: before the first pending, non-fixed item that starts at or after `tm`. */
export function reschedLater(day: Day, id: string, tm: number, n: number): Day {
  const it = find(day, id);
  if (!it) return day;
  if (tm < n) tm = n;
  const rows = schedule(day, n).rows;
  const items = day.items.filter((i) => i.id !== id);
  const tg = rows.find(
    (r) => r.it.id !== id && r.it.status === 'todo' && r.it.kind !== 'fixed' && r.end > n && r.start >= tm - 1,
  );
  const at = tg ? items.findIndex((i) => i.id === tg.it.id) : items.length;
  items.splice(at, 0, it);
  return { ...day, items };
}

export function clearDay(day: Day): Day {
  return { ...day, items: [], dayStarted: null };
}
