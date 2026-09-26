import { describe, expect, it } from 'vitest';
import { newItem } from './actions';
import { activeDayKey, dayCutoff } from './today';
import type { Day } from './types';

const FRI = '2026-09-25';
const SAT = '2026-09-26';
const friday = (o: Partial<Day> = {}): Record<string, Day> => ({
  [FRI]: { key: FRI, dayStart: 540, wrap: 1020, dayStarted: 545, items: [], ...o },
});
const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m).getTime(); // Saturday

describe('activeDayKey', () => {
  it('keeps a started day as Today after midnight', () => {
    expect(activeDayKey(SAT, friday(), at(1, 30))).toBe(FRI);
  });

  it('moves on once the day is ended', () => {
    expect(activeDayKey(SAT, friday({ dayEnded: 1500 }), at(1, 30))).toBe(SAT);
  });

  it('ignores a day that was never started', () => {
    expect(activeDayKey(SAT, friday({ dayStarted: null }), at(0, 30))).toBe(SAT);
    expect(activeDayKey(SAT, {}, at(0, 30))).toBe(SAT);
  });

  it('closes an un-ended day at 4 am', () => {
    expect(activeDayKey(SAT, friday(), at(3, 59))).toBe(FRI);
    expect(activeDayKey(SAT, friday(), at(4, 0))).toBe(SAT);
  });

  it('waits three hours past a late wrap-up, and never past noon', () => {
    expect(dayCutoff(friday({ wrap: 1620 })[FRI])).toBe(1800); // wraps at 3 am
    expect(activeDayKey(SAT, friday({ wrap: 1620 }), at(5, 30))).toBe(FRI);
    expect(activeDayKey(SAT, friday({ wrap: 1620 }), at(6, 0))).toBe(SAT);
    expect(dayCutoff(friday({ wrap: 2100 })[FRI])).toBe(2160);
  });

  it("doesn't hold on to a timer left running overnight", () => {
    const running = newItem({ title: 'Late', min: 30, status: 'running', startedAt: 1400 });
    expect(activeDayKey(SAT, friday({ items: [running] }), at(8))).toBe(SAT);
  });
});
