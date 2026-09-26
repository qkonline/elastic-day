import { describe, expect, it } from 'vitest';
import { dragShifts, type TimelineRow } from './rows';

// Just enough of each row for dragShifts: items a–d, with an idle-time row in front of c.
const item = (id: string, idx: number) => ({ type: 'item', key: id, id, idx }) as unknown as TimelineRow;
const rows: TimelineRow[] = [
  item('a', 0),
  item('b', 1),
  { type: 'gap', key: 'gc', gap: '6m' },
  item('c', 2),
  item('d', 3),
];

describe('dragShifts', () => {
  it('slides the rows in between up when a task moves down', () => {
    // Drag a to land before d: b, the idle row and c move up by a's height.
    expect(dragShifts(rows, { id: 'a', over: 3, h: 60 }, 4)).toEqual({ b: -60, gc: -60, c: -60 });
  });

  it('slides them down when a task moves up, opening the gap before the idle row', () => {
    expect(dragShifts(rows, { id: 'd', over: 2, h: 50 }, 4)).toEqual({ gc: 50, c: 50 });
  });

  it('handles dropping at the end and dropping in place', () => {
    expect(dragShifts(rows, { id: 'b', over: 4, h: 40 }, 4)).toEqual({ gc: -40, c: -40, d: -40 });
    expect(dragShifts(rows, { id: 'b', over: 2, h: 40 }, 4)).toEqual({}); // before c is where b already is
    expect(dragShifts(rows, { id: 'b', over: null, h: 40 }, 4)).toEqual({});
  });
});
