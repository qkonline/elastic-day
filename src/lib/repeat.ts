import { newItem, uid } from './actions';
import { keyDate, weekdayLong } from './time';
import type { Day, Item, Repeat, Series } from './types';

export function repeatMatches(repeat: Repeat, key: string): boolean {
  const d = keyDate(key),
    dow = d.getDay();
  if (repeat === 'Every day') return true;
  if (repeat === 'Weekdays') return dow >= 1 && dow <= 5;
  return repeat === 'Every ' + weekdayLong(d);
}

export function seriesApplies(s: Series, key: string): boolean {
  if (key < s.from) return false;
  if (s.until && key > s.until) return false;
  return repeatMatches(s.repeat, key);
}

export function seriesFromItem(it: Item, from: string, id = it.seriesId ?? uid()): Series {
  return {
    id,
    title: it.title,
    min: it.min,
    kind: it.kind,
    hue: it.hue,
    fixedAt: it.fixedAt,
    repeat: it.repeat,
    note: it.note,
    subtasks: it.subtasks.map((x) => ({ id: x.id, t: x.t })),
    from,
    until: null,
  };
}

export function itemFromSeries(s: Series): Item {
  return newItem({
    title: s.title,
    min: s.min,
    kind: s.kind,
    hue: s.hue,
    fixedAt: s.fixedAt,
    repeat: s.repeat,
    note: s.note,
    seriesId: s.id,
    subtasks: (s.subtasks ?? []).map((x) => ({ id: uid(), t: x.t, d: false })),
  });
}

/** A day that has never been stored: today or later gets its repeating items, fixed ones by time. */
export function materialize(key: string, series: Series[], dayStart: number, wrap: number, today: string): Day {
  const items = key >= today ? series.filter((s) => seriesApplies(s, key)).map(itemFromSeries) : [];
  return { key, dayStart, wrap, dayStarted: null, items };
}

/**
 * Bring a stored, not-yet-started later day in line with a series that changed from `prev` to
 * `next` (null = the series ended). The item is added only where the rule newly applies, so a
 * copy the user deleted from one day stays deleted; untouched copies are updated; copies on
 * days the rule no longer covers are dropped.
 */
export function syncSeriesInto(day: Day, next: Series | null, prev: Series | null, seriesId: string): Day {
  const idx = day.items.findIndex((i) => i.seriesId === seriesId);
  const applies = !!next && seriesApplies(next, day.key);
  if (idx < 0) {
    const newlyApplies = applies && !(prev && seriesApplies(prev, day.key));
    return newlyApplies ? { ...day, items: [...day.items, itemFromSeries(next!)] } : day;
  }
  const cur = day.items[idx];
  if (cur.status !== 'todo') return day;
  const items = [...day.items];
  if (!applies) items.splice(idx, 1);
  else {
    // Keep ticks on steps that survived the edit; each existing step is matched at most once.
    const unused = [...cur.subtasks];
    const steps = next!.subtasks.map((x) => {
      const at = unused.findIndex((y) => y.t === x.t);
      return at >= 0 ? unused.splice(at, 1)[0] : { id: uid(), t: x.t, d: false };
    });
    items[idx] = {
      ...cur,
      title: next!.title,
      min: next!.min,
      kind: next!.kind,
      hue: next!.hue,
      fixedAt: next!.fixedAt,
      repeat: next!.repeat,
      note: next!.note,
      subtasks: steps,
    };
  }
  return { ...day, items };
}
