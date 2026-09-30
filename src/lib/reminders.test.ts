import { describe, expect, it } from 'vitest';
import { newItem } from './actions';
import { headsUps, pushPlan, SAME_PUSH_MS } from './reminders';
import { atMinutes, minutesInto } from './time';
import type { Day } from './types';

const day = (key: string, items: Day['items'], more: Partial<Day> = {}): Day => ({
  key,
  dayStart: 540,
  wrap: 1020,
  dayStarted: null,
  items,
  ...more,
});
const fixed = (title: string, at: number) => newItem({ title, kind: 'fixed', fixedAt: at });
const note = (tag: string) => ({ title: 'T', body: tag, tag });

describe('clock times as moments', () => {
  it('turns minutes into a day back into the moment, past midnight too', () => {
    expect(atMinutes('2026-09-25', 570)).toBe(new Date(2026, 8, 25, 9, 30).getTime());
    expect(atMinutes('2026-09-25', 1500)).toBe(new Date(2026, 8, 26, 1, 0).getTime());
    expect(minutesInto('2026-09-25', atMinutes('2026-09-25', 875))).toBe(875);
  });
});

describe('heads-ups before fixed times', () => {
  const morning = new Date(2026, 8, 25, 8, 0).getTime();

  it('gives one for each fixed-time task still to do, the lead before it', () => {
    const call = fixed('Call', 900);
    const done = { ...fixed('Done', 960), status: 'done' as const };
    const list = headsUps([day('2026-09-25', [newItem({ title: 'Loose' }), done, call])], 5, morning);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ it: call, tag: `fixed-2026-09-25-${call.id}` });
    expect(list[0].startsAt).toBe(new Date(2026, 8, 25, 15, 0).getTime());
    expect(list[0].at).toBe(new Date(2026, 8, 25, 14, 55).getTime());
  });

  it('gives none when switched off, or for a day that has ended', () => {
    expect(headsUps([day('2026-09-25', [fixed('Call', 900)])], 0, morning)).toEqual([]);
    expect(headsUps([day('2026-09-25', [fixed('Call', 900)], { dayEnded: 800 })], 5, morning)).toEqual([]);
  });

  it('follows a fixed-time task the tasks before it have moved later', () => {
    const rest = newItem({ title: 'Rest', kind: 'buffer', min: 60 });
    const [h] = headsUps([day('2026-09-25', [rest, fixed('Session', 540)])], 5, morning);
    expect(h.start).toBe(600);
    expect(h.at).toBe(new Date(2026, 8, 25, 9, 55).getTime());
  });

  it('names a repeating task by its series, so a rebuilt day keeps the same tag', () => {
    const standup = { ...fixed('Standup', 570), seriesId: 'S1' };
    expect(headsUps([day('2026-09-26', [standup])], 10, morning)[0].tag).toBe('fixed-2026-09-26-S1');
  });
});

describe('push plan', () => {
  const now = 1_790_000_000_000;

  it('books what is still ahead, in time order, sharing a push when close together', () => {
    const plan = pushPlan(
      [
        { at: now + 20 * 60_000, note: note('later') },
        { at: now - 1000, note: note('past') },
        { at: now + 5 * 60_000, note: note('first') },
        { at: now + 5 * 60_000 + SAME_PUSH_MS - 1000, note: note('with first') },
        { at: now + 30 * 3600_000, note: note('too far') },
      ],
      now,
    );
    expect(plan.map((g) => [g.at - now, g.notes.map((n) => n.tag)])).toEqual([
      [5 * 60_000, ['first', 'with first']],
      [20 * 60_000, ['later']],
    ]);
  });
});
