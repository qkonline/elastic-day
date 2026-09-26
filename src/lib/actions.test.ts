import { describe, expect, it } from 'vitest';
import * as A from './actions';
import type { Day, Item } from './types';

const t = (title: string, min: number, o: Partial<Item> = {}) => A.newItem({ title, min, id: title, ...o });
const day = (items: Item[], o: Partial<Day> = {}): Day => ({
  key: '2026-09-25',
  dayStart: 540,
  wrap: 1020,
  dayStarted: null,
  items,
  ...o,
});
const st = (d: Day) => d.items.map((i) => `${i.id}:${i.status}`);

describe('timer actions', () => {
  it('starting an item finishes the running one as done and stamps the day', () => {
    let d = day([t('a', 30), t('b', 30)]);
    d = A.startItem(d, 'a', 545);
    expect(d.dayStarted).toBe(545);
    d = A.startItem(d, 'b', 560);
    expect(st(d)).toEqual(['a:done', 'b:running']);
    expect(d.items[0].endedAt).toBe(560);
  });

  it('starting while another is paused banks the pause before finishing it', () => {
    let d = day([t('a', 30, { status: 'paused', startedAt: 540, pausedAt: 550 }), t('b', 30)]);
    d = A.startItem(d, 'b', 560);
    expect(d.items[0]).toMatchObject({ status: 'done', pausedFor: 10, pausedAt: null, endedAt: 560 });
  });

  it('never starts a buffer', () => {
    const d = day([t('buf', 15, { kind: 'buffer' })]);
    expect(A.startItem(d, 'buf', 540)).toBe(d);
  });

  it('Start my day starts the first pending task, skipping buffers', () => {
    const d = A.startDay(day([t('buf', 15, { kind: 'buffer' }), t('a', 30)]), 552);
    expect(d.dayStarted).toBe(552);
    expect(st(d)).toEqual(['buf:todo', 'a:running']);
  });

  it('pause and resume accumulate paused time', () => {
    let d = A.startItem(day([t('a', 30)]), 'a', 540);
    d = A.pause(d, 'a', 550);
    d = A.resume(d, 'a', 557);
    expect(d.items[0]).toMatchObject({ status: 'running', pausedFor: 7, pausedAt: null });
    d = A.finish(d, 'a', 580);
    expect(d.items[0]).toMatchObject({ status: 'done', endedAt: 580 });
  });
});

describe('postpone', () => {
  it('Later today, not started: moves to the end', () => {
    const d = A.postponeLater(day([t('a', 30), t('b', 30)]), 'a', 540);
    expect(st(d)).toEqual(['b:todo', 'a:todo']);
  });

  it('Later today, mid-task: keeps the logged time and appends the remainder', () => {
    const d = A.postponeLater(day([t('a', 45, { status: 'running', startedAt: 540 }), t('b', 30)]), 'a', 560);
    expect(d.items[0]).toMatchObject({ status: 'postponed', endedAt: 560, laterCopy: true });
    expect(d.items[2]).toMatchObject({ title: 'a', min: 25, continued: true, status: 'todo' });
  });

  it('moving a not-started item to another day leaves an undoable marker', () => {
    const res = A.moveOut(day([t('a', 30, { subtasks: [{ id: 's', t: 'x', d: true }] })]), 'a', '2026-09-26', 540)!;
    expect(res.day.items[0]).toMatchObject({
      status: 'postponed',
      movedKey: '2026-09-26',
      movedId: res.copy.id,
      startedAt: null,
    });
    expect(res.copy).toMatchObject({ title: 'a', min: 30, status: 'todo', repeat: 'Once' });
    expect(res.copy.subtasks[0].d).toBe(false);
    const back = A.restore(res.day, 'a');
    expect(back.items[0]).toMatchObject({ status: 'todo', movedKey: null });
  });

  it('moving mid-task keeps the logged time and moves only what is left', () => {
    const res = A.moveOut(day([t('a', 60, { status: 'running', startedAt: 540 })]), 'a', '2026-09-26', 580)!;
    expect(res.day.items[0]).toMatchObject({ status: 'postponed', startedAt: 540, endedAt: 580 });
    expect(res.copy).toMatchObject({ min: 20, continued: true });
  });
});

describe('reschedule', () => {
  it('Start now goes before the first pending item when nothing is active', () => {
    // 'a' was missed; 'b' and 'c' are still ahead.
    const d = day(
      [t('a', 30), t('done', 30, { status: 'done', startedAt: 600, endedAt: 630 }), t('b', 30), t('c', 30)],
      { dayStarted: 540 },
    );
    const res = A.reschedNow(d, 'a', 640);
    expect(res.start).toBe(true);
    expect(res.day.items.map((i) => i.id)).toEqual(['done', 'a', 'b', 'c']);
  });

  it('Do it next goes right after the active item', () => {
    const d = day([t('a', 30), t('run', 30, { status: 'running', startedAt: 600 }), t('b', 30)], { dayStarted: 540 });
    const res = A.reschedNow(d, 'a', 610);
    expect(res.start).toBe(false);
    expect(res.day.items.map((i) => i.id)).toEqual(['run', 'a', 'b']);
  });

  it('Later today goes before the first pending item starting at or after the time', () => {
    const d = day([t('a', 30), t('b', 60), t('c', 60), t('d', 60)]);
    // Planned: a 9:00, b 9:30, c 10:30, d 11:30. Move 'a' to around 11:00 (before d).
    const out = A.reschedLater(d, 'a', 660, 545);
    expect(out.items.map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('reorder', () => {
  it('drops before the target index', () => {
    const d = day([t('a', 1), t('b', 1), t('c', 1)]);
    expect(A.reorder(d, 'a', 3).items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(A.reorder(d, 'c', 0).items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(A.move(d, 'b', -1).items.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('setKind to fixed defaults the time and swaps cyan for indigo', () => {
    const d = A.setKind(day([t('a', 30)]), 'a', 'fixed');
    expect(d.items[0]).toMatchObject({ kind: 'fixed', fixedAt: 540, hue: 'indigo' });
  });
});
