// The app state against an in-memory IndexedDB: what gets stored, and what comes back after
// a reload (a fresh Planner reading the same database).

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import { Planner } from './planner.svelte';

const TODAY = '2026-09-25'; // a Friday
const TOMORROW = '2026-09-26';
const live: Planner[] = [];

async function boot(): Promise<Planner> {
  const p = new Planner();
  live.push(p);
  await p.init();
  return p;
}

const add = (p: Planner, title: string, min = 30) =>
  p.addTask({ title, min, kind: 'task', hue: 'cyan', fixedAt: null });
const byTitle = (p: Planner, title: string) => p.day.items.find((i) => i.title === title)!;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 25, 10, 0));
  await db.closeDb();
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  live.splice(0).forEach((p) => p.destroy());
  vi.useRealTimers();
});

describe('Planner', () => {
  it('starts on a blank today', async () => {
    const p = await boot();
    expect(p.ready).toBe(true);
    expect(p.viewKey).toBe(TODAY);
    expect(p.day.items).toEqual([]);
    expect(p.settings.themePref).toBe('match');
  });

  it('keeps tasks and timer state across a reload', async () => {
    const p = await boot();
    add(p, 'Write');
    add(p, 'Review');
    p.startItem(byTitle(p, 'Write').id);
    await p.flush();

    const q = await boot();
    expect(q.day.items.map((i) => [i.title, i.status])).toEqual([
      ['Write', 'running'],
      ['Review', 'todo'],
    ]);
    expect(q.day.dayStarted).toBeCloseTo(600, 0);
  });

  it('moves a task to tomorrow and can undo it', async () => {
    const p = await boot();
    add(p, 'Call');
    const id = byTitle(p, 'Call').id;
    await p.postpone(id, 'tomorrow');
    await p.flush();
    expect(byTitle(p, 'Call').status).toBe('postponed');
    expect((await db.getDay(TOMORROW))?.items.map((i) => i.title)).toEqual(['Call']);

    await p.restore(id);
    await p.flush();
    expect(byTitle(p, 'Call').status).toBe('todo');
    expect((await db.getDay(TOMORROW))?.items).toEqual([]);
  });

  it('repeats an item on later days until it stops repeating', async () => {
    const p = await boot();
    add(p, 'Standup', 15);
    // A later day that already exists gets the new repeating item too.
    await p.switchDay('2026-09-28');
    add(p, 'Monday thing');
    await p.switchDay(TODAY);
    await p.setRepeat(byTitle(p, 'Standup').id, 'Weekdays');
    await p.flush();

    expect((await db.getDay('2026-09-28'))?.items.map((i) => i.title)).toEqual(['Monday thing', 'Standup']);
    await p.switchDay('2026-09-29'); // never stored: built from the series
    expect(p.day.items.map((i) => i.title)).toEqual(['Standup']);
    await p.switchDay('2026-09-27'); // Sunday
    expect(p.day.items).toEqual([]);

    await p.switchDay(TODAY);
    await p.stopRepeating(byTitle(p, 'Standup').id);
    await p.flush();
    expect((await db.getDay('2026-09-28'))?.items.map((i) => i.title)).toEqual(['Monday thing']);
    const q = await boot();
    await q.switchDay('2026-09-29');
    expect(q.day.items).toEqual([]);
  });

  it('pushes edits of a repeating item to later days not yet started', async () => {
    const p = await boot();
    add(p, 'Email', 45);
    await p.setRepeat(byTitle(p, 'Email').id, 'Every day');
    await p.switchDay(TOMORROW);
    add(p, 'Other');
    await p.switchDay(TODAY);
    p.edit(byTitle(p, 'Email').id, { title: 'Inbox', min: 30 });
    await new Promise((r) => setTimeout(r, 700));
    await p.flush();
    expect((await db.getDay(TOMORROW))?.items.map((i) => [i.title, i.min])).toEqual([
      ['Inbox', 30],
      ['Other', 30],
    ]);
  });

  it('keeps a repeating-item edit when the user switches day straight away', async () => {
    const p = await boot();
    add(p, 'Email', 45);
    await p.setRepeat(byTitle(p, 'Email').id, 'Every day');
    await p.switchDay(TOMORROW);
    add(p, 'Other');
    await p.switchDay(TODAY);
    p.edit(byTitle(p, 'Email').id, { title: 'Inbox' });
    await p.switchDay('2026-09-30'); // before the batched series sync fires
    await new Promise((r) => setTimeout(r, 700));
    await p.flush();
    expect((await db.getDay(TOMORROW))?.items.map((i) => i.title)).toEqual(['Inbox', 'Other']);
    expect(p.day.items.map((i) => i.title)).toEqual(['Inbox']); // built from the updated series
  });

  it('picks up changes made in another tab', async () => {
    const a = await boot();
    const b = await boot();
    add(b, 'From the other tab');
    await b.flush();
    await new Promise((r) => setTimeout(r, 50));
    expect(a.day.items.map((i) => i.title)).toEqual(['From the other tab']);
  });

  it('rebuilds unsaved days when the default hours change', async () => {
    const p = await boot();
    await p.switchDay(TOMORROW);
    expect(p.day.dayStart).toBe(540);
    p.setSettings({ defStart: 480 });
    expect(p.day.dayStart).toBe(480);
  });

  it('never runs two timers when one was left going overnight', async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 23, 30));
    const p = await boot();
    add(p, 'Late');
    p.startItem(byTitle(p, 'Late').id);
    await p.flush();

    vi.setSystemTime(new Date(2026, 8, 26, 8, 0));
    const q = await boot();
    expect(q.viewKey).toBe(TOMORROW);
    expect(q.elsewhere).toMatchObject({ key: TODAY, it: { title: 'Late', status: 'running' } });
    add(q, 'Morning');
    q.startItem(byTitle(q, 'Morning').id);
    await q.flush();
    expect((await db.getDay(TODAY))?.items[0].status).toBe('done');
    expect(q.elsewhere).toBeNull();
  });

  it('can make a new task repeat from the start', async () => {
    const p = await boot();
    p.addTask({ title: 'Stretch', min: 10, kind: 'task', hue: 'lime', fixedAt: null, repeat: 'Every day' });
    await new Promise((r) => setTimeout(r, 50));
    expect(byTitle(p, 'Stretch')).toMatchObject({ repeat: 'Every day' });
    expect(byTitle(p, 'Stretch').seriesId).toBeTruthy();
    await p.switchDay(TOMORROW);
    expect(p.day.items.map((i) => i.title)).toEqual(['Stretch']);
  });

  it('keeps the week strip on the week of the day shown', async () => {
    const p = await boot();
    await p.switchDay('2026-09-28'); // next Monday, e.g. swiping on from Sunday
    expect(p.weekOff).toBe(1);
    expect(p.weekKeys[0]).toBe('2026-09-28');
    await p.switchDay('2026-09-27');
    expect(p.weekOff).toBe(0);
    expect(p.weekKeys).toContain('2026-09-27');
  });

  it('keeps a late night on the day it started, until the day is ended', async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 22, 0));
    const p = await boot();
    add(p, 'Ship it');
    add(p, 'Emails');
    p.addTask({ title: 'Vitamins', min: 0, kind: 'check', hue: 'lime', fixedAt: null });
    p.startDay();
    await p.flush();

    vi.setSystemTime(new Date(2026, 8, 26, 1, 0));
    const q = await boot();
    expect(q.today).toBe(TODAY);
    expect(q.viewKey).toBe(TODAY);
    expect(q.n).toBe(1500);

    await q.endDay(true);
    await vi.waitFor(() => expect(q.viewKey).toBe(TOMORROW));
    expect(q.today).toBe(TOMORROW);
    expect(q.day.items.map((i) => i.title)).toEqual(['Emails', 'Vitamins']);
    await q.flush();
    const friday = await db.getDay(TODAY);
    expect(friday?.dayEnded).toBe(1500);
    expect(friday?.items.map((i) => [i.title, i.status])).toEqual([
      ['Ship it', 'done'],
      ['Emails', 'postponed'],
      ['Vitamins', 'postponed'],
    ]);
  });

  it('with a flexible start, counts the day from when it starts', async () => {
    const p = await boot();
    p.completeOnboarding({ start: 540, length: 600, flex: true });
    add(p, 'Deep work', 90);
    expect(p.planDay).toMatchObject({ dayStart: 600, wrap: 1200 });
    expect(p.sch.rows[0].start).toBe(600);
    vi.setSystemTime(new Date(2026, 8, 25, 10, 20));
    p.tick();
    p.startDay();
    expect(p.day).toMatchObject({ dayStarted: 620, dayStart: 620, wrap: 1220 });
  });

  it('shows the welcome once, and never to someone who already has a plan', async () => {
    const p = await boot();
    expect(p.showWelcome).toBe(true);
    p.completeOnboarding({ start: 420, length: 600, flex: false });
    expect(p.showWelcome).toBe(false);
    expect(p.settings).toMatchObject({ defStart: 420, dayLength: 600, defWrap: 1020, flexStart: false });
    await p.flush();
    expect((await boot()).showWelcome).toBe(false);

    await p.eraseAll();
    await db.putDay({ key: TODAY, dayStart: 540, wrap: 1020, dayStarted: null, items: [] });
    expect((await boot()).showWelcome).toBe(false);
  });

  it('erases everything', async () => {
    const p = await boot();
    add(p, 'A');
    p.setSettings({ clock24: true });
    await p.flush();
    await p.eraseAll();
    const q = await boot();
    expect(q.day.items).toEqual([]);
    expect(q.settings.clock24).toBe(false);
  });
});
