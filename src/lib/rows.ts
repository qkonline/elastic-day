// Timeline view models: what each row of the day looks like at time `n`.

import { isActive, isMissed, isPartial, pausedTotal, worked, type Row } from './schedule';
import { apOf, cd, dL, fT, fTs, keyDate, shortDate } from './time';
import type { Day, Item, Status } from './types';
import { HUES } from './types';

// Running colour: orange ring, orange countdown text while within time (red once over).
export const RUN = '#fb923c';
export const RUN_T = 'var(--orT)';
const runFill = (p: number) =>
  `linear-gradient(to bottom, rgba(251,146,60,.30) 0 ${p}%, rgba(251,146,60,.10) ${p}% 100%)`;
const pausedFill = (p: number) => `linear-gradient(to bottom, var(--pfill) 0 ${p}%, var(--raised) ${p}% 100%)`;

export interface Flag {
  t: string;
  tone: 'y' | 'r';
}

export interface ItemVM {
  type: 'item';
  key: string;
  id: string;
  idx: number;
  it: Item;
  s: Status;
  w: number;
  p: number;
  pausedTot: number;
  isOver: boolean;
  active: boolean;
  missed: boolean;
  start: number;
  end: number;
  h: number;
  capBg: string;
  capBorder: string;
  op: number;
  mutedT: boolean;
  sub: string | null;
  subTone: string;
  count: string | null;
  countColor: string;
  countSub: string | null;
  flags: Flag[];
  badges: string[];
  t1: string | null;
  t2: string | null;
  ap1: string | null;
  ap2: string | null;
  fixedAt: string | null;
  hue: string;
  aStart: boolean;
  aCheck: boolean;
  aRestore: boolean;
  restoreLabel: string;
  glyph: string | null;
  /** Now line inside this row: fraction of the capsule height. */
  nowIn: number | null;
}

export type TimelineRow =
  ItemVM | { type: 'gap'; key: string; gap: string } | { type: 'drop'; key: string } | { type: 'now'; key: string };

export interface Ctx {
  day: Day;
  rows: Row[];
  n: number;
  isToday: boolean;
  showTimes: boolean;
  clock24: boolean;
  drag: { id: string; over: number | null } | null;
}

export const capHeight = (min: number) => Math.max(44, Math.round(min * 0.85));

export function itemVM(r: Row, c: Ctx): ItemVM {
  const { it, idx } = r;
  const s = it.status,
    n = c.n;
  const missedAny = c.isToday && isMissed(r, n);
  const missed = missedAny && it.kind !== 'buffer';
  const pBuf = missedAny && it.kind === 'buffer';
  const w = worked(it, n);
  const frac = Math.max(0, Math.min(1, w / it.min));
  const p = Math.round(frac * 100);
  const active = isActive(it);
  const isOver = active && w >= it.min;
  const pausedTot = pausedTotal(it, n);
  const h = capHeight(it.min);

  let capBg = 'var(--raised)',
    capBorder = '1px solid var(--border)';
  if (it.kind === 'buffer') {
    capBg = 'var(--bg)';
    capBorder = '1.5px dashed var(--faint)';
  }
  if (r.pastEnd) capBorder = '1.5px dashed #f87171';
  if (missed) capBorder = '1.5px dashed #eab308';
  if (s === 'running') {
    capBg = isOver ? 'rgba(248,113,113,.16)' : runFill(p);
    capBorder = isOver ? '2px solid #f87171' : `2px solid ${RUN}`;
  }
  if (s === 'paused') {
    capBg = pausedFill(p);
    capBorder = '2px solid var(--muted)';
  }

  let sub: string | null = null,
    subTone = 'var(--muted)';
  if (s === 'done' && Math.abs(w - it.min) >= 1) sub = 'took ' + dL(w);
  if (s === 'done' && it.marked) sub = 'marked done';
  if (pBuf) sub = 'passed';
  if (s === 'postponed') {
    const where = it.movedKey ? 'moved to ' + shortDate(keyDate(it.movedKey)) : 'moved to tomorrow';
    sub = isPartial(it)
      ? `worked ${dL(w)} · rest ${it.laterCopy ? 'later today' : where}`
      : it.movedKey
        ? 'Moved to ' + shortDate(keyDate(it.movedKey))
        : 'Moved to tomorrow';
  }
  if (active && pausedTot >= 0.5) sub = `worked ${dL(w)} · paused ${dL(pausedTot)}`;
  else if (s === 'running' && isOver) {
    sub = 'running ' + dL(w);
    subTone = 'var(--redT)';
  }

  const leftS = (it.min - w) * 60;
  const pl = s === 'paused' ? n - it.pausedAt! : 0;

  const flags: Flag[] = [];
  if (missed) flags.push({ t: 'Missed', tone: 'y' });
  if (r.runsInto) flags.push({ t: 'runs into a fixed event', tone: 'y' });
  if (r.pastEnd) flags.push({ t: "won't fit today", tone: 'r' });

  const badges: string[] = [];
  if (it.repeat !== 'Once') badges.push('↻ ' + it.repeat);
  if (it.subtasks.length) badges.push(`☑ ${it.subtasks.filter((x) => x.d).length}/${it.subtasks.length}`);
  if (it.note) badges.push('✎ note');
  if (it.continued) badges.push('↷ continued');

  const t = c.showTimes;
  const showEnd = t && h >= 60;
  return {
    type: 'item',
    key: it.id,
    id: it.id,
    idx,
    it,
    s,
    w,
    p,
    pausedTot,
    isOver,
    active,
    missed,
    start: r.start,
    end: r.end,
    h,
    capBg,
    capBorder,
    op: pBuf || s === 'done' || s === 'postponed' ? 0.45 : s === 'skipped' ? 0.3 : 1,
    mutedT: ['done', 'skipped', 'postponed'].includes(s) || it.kind === 'buffer',
    sub,
    subTone,
    count: active ? (leftS >= 0 ? cd(leftS) : '+' + cd(-leftS)) : null,
    countColor: s === 'paused' ? 'var(--muted)' : isOver ? 'var(--redT)' : RUN_T,
    countSub: s === 'paused' ? 'Paused ' + (pl < 1 ? Math.floor(pl * 60) + 's' : dL(pl)) : null,
    flags,
    badges,
    t1: t ? fTs(r.start, c.clock24) : null,
    t2: showEnd ? fTs(r.end, c.clock24) : null,
    ap1: t ? apOf(r.start, c.clock24) : null,
    ap2: showEnd ? apOf(r.end, c.clock24) : null,
    fixedAt: it.kind === 'fixed' && it.fixedAt != null ? fT(it.fixedAt, c.clock24) : null,
    hue: HUES[it.hue] ?? HUES.cyan,
    aStart: s === 'todo' && c.isToday && !missed && !pBuf && it.kind !== 'buffer',
    aCheck: s === 'done',
    aRestore: s === 'skipped' || (s === 'postponed' && it.startedAt == null),
    restoreLabel: s === 'postponed' ? 'Undo' : 'Restore',
    glyph: !c.isToday && s === 'todo' ? '○' : null,
    nowIn: null,
  };
}

/** The ordered list for the Spine timeline: items, idle gaps, the drop marker and the now line. */
export function timelineRows(c: Ctx): TimelineRow[] {
  const out: TimelineRow[] = [];
  for (const r of c.rows) {
    const v = itemVM(r, c);
    if (r.gap) out.push({ type: 'gap', key: 'g' + v.id, gap: dL(r.gap) });
    if (c.drag && c.drag.over === r.idx && c.drag.id !== v.id) out.push({ type: 'drop', key: 'drop' });
    out.push(v);
  }
  if (c.drag && c.drag.over === c.day.items.length) out.push({ type: 'drop', key: 'drop' });

  if (c.isToday && c.rows.length) {
    const n = c.n;
    const live = (x: TimelineRow): x is ItemVM => x.type === 'item' && x.s !== 'skipped' && x.s !== 'postponed';
    const inside = out.find((x) => live(x) && x.start <= n && n < x.end) as ItemVM | undefined;
    if (inside) inside.nowIn = Math.max(0, Math.min(1, (n - inside.start) / (inside.end - inside.start)));
    else {
      let at = out.findIndex((x) => live(x) && x.start >= n);
      if (at > 0 && out[at - 1].type === 'gap') at--;
      const nr: TimelineRow = { type: 'now', key: 'now' };
      if (at < 0) out.push(nr);
      else out.splice(at, 0, nr);
    }
  }
  return out;
}

/** Week-strip dot: lime = all done, orange = some pending, faint = planned, none = empty. */
export function dayDot(d: Day | undefined, key: string, today: string): string | null {
  if (!d) return null;
  const real = d.items.filter(
    (i) => i.kind !== 'buffer' && i.status !== 'skipped' && !(i.status === 'postponed' && !isPartial(i)),
  );
  if (!real.length) return null;
  if (key > today) return 'var(--faint)';
  const done = real.filter((i) => i.status === 'done' || isPartial(i)).length;
  const pending = real.length - done;
  if (key === today && done === 0) return 'var(--faint)';
  if (pending === 0) return '#a3e635';
  return '#fb923c';
}
