import { describe, expect, it } from 'vitest';
import { newItem } from './actions';
import { isMissed, schedule, worked } from './schedule';
import { minutesInto } from './time';
import type { Day, Item } from './types';

const day = (items: Item[], o: Partial<Day> = {}): Day => ({
  key: '2026-09-25',
  dayStart: 540,
  wrap: 1020,
  dayStarted: null,
  items,
  ...o,
});
const t = (title: string, min: number, o: Partial<Item> = {}) => newItem({ title, min, ...o });

describe('schedule', () => {
  it('chains todo items from the day start when the day has not started', () => {
    const { rows, finish } = schedule(day([t('a', 30), t('b', 45)]), 500);
    expect(rows.map((r) => [r.start, r.end])).toEqual([
      [540, 570],
      [570, 615],
    ]);
    expect(finish).toBe(615);
  });

  it('chains from dayStarted once the day has started', () => {
    const { rows } = schedule(day([t('a', 30)], { dayStarted: 552 }), 552);
    expect(rows[0].start).toBe(552);
  });

  it('uses actual times for done items and reports idle gaps', () => {
    const d = day(
      [
        t('a', 15, { status: 'done', startedAt: 552, endedAt: 564 }),
        t('b', 30, { status: 'done', startedAt: 570, endedAt: 600 }),
      ],
      {
        dayStarted: 552,
      },
    );
    const { rows } = schedule(d, 610);
    expect(rows[0]).toMatchObject({ start: 552, end: 564, gap: 0 });
    expect(rows[1]).toMatchObject({ start: 570, end: 600, gap: 6 });
  });

  it('extends a running item past its planned end while it runs over', () => {
    const d = day([t('a', 30, { status: 'running', startedAt: 540 }), t('b', 30)], { dayStarted: 540 });
    expect(schedule(d, 560).rows.map((r) => r.end)).toEqual([570, 600]);
    expect(schedule(d, 590).rows.map((r) => r.end)).toEqual([590, 620]);
  });

  it('slides the rest of the day later while paused', () => {
    const d = day([t('a', 30, { status: 'paused', startedAt: 540, pausedAt: 550 }), t('b', 30)], { dayStarted: 540 });
    // 10 minutes worked, 20 left: ends 20 minutes after now, whatever now is.
    expect(schedule(d, 560).rows[0].end).toBe(580);
    expect(schedule(d, 600).rows[0].end).toBe(620);
    expect(schedule(d, 600).rows[1].start).toBe(620);
  });

  it('places fixed items at their time and lets the cursor jump past them', () => {
    const d = day([t('a', 20), t('std', 15, { kind: 'fixed', fixedAt: 570 }), t('b', 30)]);
    const { rows } = schedule(d, 500);
    expect(rows[1]).toMatchObject({ start: 570, end: 585 });
    expect(rows[2].start).toBe(585);
  });

  it('does not slide the plan through idle time, so items become missed', () => {
    const d = day([t('a', 30), t('b', 30)]);
    const { rows } = schedule(d, 700);
    expect(rows[0].end).toBe(570);
    expect(isMissed(rows[0], 700)).toBe(true);
    expect(isMissed(rows[1], 700)).toBe(true);
  });

  it('flags items that run into a fixed event or past wrap-up', () => {
    const d = day([t('long', 60), t('std', 15, { kind: 'fixed', fixedAt: 570 }), t('late', 600)]);
    const { rows } = schedule(d, 500);
    expect(rows[0].runsInto).toBe(true);
    expect(rows[2].pastEnd).toBe(true);
    expect(rows[1].runsInto).toBeUndefined();
  });

  it('gives skipped and not-started postponed items zero height', () => {
    const d = day([t('a', 30, { status: 'skipped' }), t('b', 30, { status: 'postponed' }), t('c', 30)]);
    const { rows } = schedule(d, 500);
    expect(rows[0].end - rows[0].start).toBe(0);
    expect(rows[1].end - rows[1].start).toBe(0);
    expect(rows[2].start).toBe(540);
  });
});

describe('worked', () => {
  it('subtracts paused time', () => {
    expect(worked(t('a', 30, { status: 'running', startedAt: 540, pausedFor: 5 }), 560)).toBe(15);
    expect(worked(t('a', 30, { status: 'paused', startedAt: 540, pausedAt: 550, pausedFor: 2 }), 600)).toBe(8);
    expect(worked(t('a', 30, { status: 'done', startedAt: 540, endedAt: 580, pausedFor: 10 }), 600)).toBe(30);
    expect(worked(t('a', 30), 600)).toBe(0);
  });
});

describe('minutesInto', () => {
  it('follows the wall clock, including on days the clocks change', () => {
    expect(minutesInto('2026-09-25', new Date(2026, 8, 25, 10, 0).getTime())).toBe(600);
    // US/EU clock changes: 10:00 is still minute 600 of the day.
    expect(minutesInto('2026-03-08', new Date(2026, 2, 8, 10, 0).getTime())).toBe(600);
    expect(minutesInto('2026-03-29', new Date(2026, 2, 29, 10, 0).getTime())).toBe(600);
    expect(minutesInto('2026-11-01', new Date(2026, 10, 1, 10, 0).getTime())).toBe(600);
    // Past midnight counts on from the same day.
    expect(minutesInto('2026-09-25', new Date(2026, 8, 26, 0, 30).getTime())).toBe(1470);
  });
});
