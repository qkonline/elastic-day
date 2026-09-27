// Time's up in the background: one notification, from the push when one is booked, otherwise
// from the page itself.

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';

vi.mock('./push', () => ({
  pushConfigured: () => true,
  preparePush: vi.fn(async () => true),
  schedulePush: vi.fn(() => booked),
  cancelPush: vi.fn(),
  unsubscribePush: vi.fn(async () => {}),
}));
vi.mock('./alert', () => ({
  chime: vi.fn(),
  vibrate: vi.fn(),
  notifyHidden: vi.fn(),
  unlockAudio: vi.fn(),
  unlockOnFirstGesture: vi.fn(),
  requestNotifications: vi.fn(async () => 'granted'),
}));

let booked = true;
const { Planner } = await import('./planner.svelte');
const { notifyHidden } = await import('./alert');
const { schedulePush } = await import('./push');

async function timerInBackground() {
  const p = new Planner();
  await p.init();
  p.setSettings({ notify: true, onboarded: true });
  p.addTask({ title: 'Focus', min: 15, kind: 'task', hue: 'cyan', fixedAt: null });
  p.startDay();
  (p as unknown as { onHidden(): void }).onHidden(); // the phone locks
  vi.setSystemTime(new Date(2026, 8, 25, 10, 20)); // time runs out while it's away
  p.tick();
  return p;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 25, 10, 0));
  await db.closeDb();
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("time's up in the background", () => {
  it('leaves the notification to the push when one is booked', async () => {
    booked = true;
    const p = await timerInBackground();
    expect(schedulePush).toHaveBeenCalledOnce();
    expect(notifyHidden).not.toHaveBeenCalled();
    p.destroy();
  });

  it('shows its own when no push could be booked', async () => {
    booked = false;
    const p = await timerInBackground();
    expect(notifyHidden).toHaveBeenCalledWith("Time's up", 'Focus', expect.stringMatching(/^timer-/));
    p.destroy();
  });
});
