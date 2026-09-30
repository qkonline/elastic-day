// Time's up and heads-ups before fixed times in the background: one notification, from the
// push when one is booked, otherwise from the page itself.

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
const { chime, notifyHidden } = await import('./alert');
const { schedulePush } = await import('./push');

type Hidden = { onHidden(): void; onVisible(): void };

async function timerInBackground() {
  const p = new Planner();
  await p.init();
  p.setSettings({ notify: true, onboarded: true });
  p.addTask({ title: 'Focus', min: 15, kind: 'task', hue: 'cyan', fixedAt: null });
  p.startDay();
  (p as unknown as Hidden).onHidden(); // the phone locks
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

describe('heads-up before a fixed time', () => {
  async function callAt3() {
    const p = new Planner();
    await p.init();
    p.setSettings({ notify: true, onboarded: true, alertOn: true });
    p.addTask({ title: 'Call', min: 30, kind: 'fixed', hue: 'cyan', fixedAt: 900 });
    return p;
  }

  it('chimes and shows the banner as the time comes up, then clears it at the start', async () => {
    const p = await callAt3();
    vi.setSystemTime(new Date(2026, 8, 25, 14, 54));
    p.tick();
    expect(p.comingUp).toBeNull();
    vi.setSystemTime(new Date(2026, 8, 25, 14, 55));
    p.tick();
    expect(p.comingUp?.it.title).toBe('Call');
    expect(chime).toHaveBeenCalledOnce();
    expect(p.announce).toBe('Coming up at 3:00 pm: Call');
    p.tick();
    expect(chime).toHaveBeenCalledOnce();
    vi.setSystemTime(new Date(2026, 8, 25, 15, 0));
    p.tick();
    expect(p.comingUp).toBeNull();
    p.destroy();
  });

  it('shows the banner without a chime when the app opens inside the heads-up', async () => {
    const p = await callAt3();
    await p.flush();
    p.destroy();
    vi.setSystemTime(new Date(2026, 8, 25, 14, 57));
    const q = new Planner();
    await q.init();
    q.tick();
    expect(q.comingUp?.it.title).toBe('Call');
    expect(chime).not.toHaveBeenCalled();
    q.dismissHeadsUp(q.comingUp!);
    expect(q.comingUp).toBeNull();
    q.destroy();
  });

  it('books it with the push worker, with what to say stored for the service worker', async () => {
    booked = true;
    const p = await callAt3();
    (p as unknown as Hidden).onHidden();
    const at = new Date(2026, 8, 25, 14, 55).getTime();
    expect(schedulePush).toHaveBeenCalledWith([at]);
    await new Promise((r) => setTimeout(r, 20));
    const meta = await new Promise<unknown>((resolve) => {
      const req = indexedDB.open('elastic-day');
      req.onsuccess = () => {
        const get = req.result.transaction('meta').objectStore('meta').get('alerts');
        get.onsuccess = () => resolve(get.result);
      };
    });
    expect(meta).toEqual({
      groups: [
        {
          at,
          notes: [{ title: 'Coming up at 3:00 pm', body: 'Call', tag: expect.stringMatching(/^fixed-2026-09-25-/) }],
        },
      ],
    });

    vi.setSystemTime(new Date(2026, 8, 25, 14, 56));
    p.tick();
    expect(notifyHidden).not.toHaveBeenCalled(); // the push brings it
    (p as unknown as Hidden).onVisible();
    expect(chime).not.toHaveBeenCalled(); // and it doesn't ring again on the way back
    expect(p.comingUp?.it.title).toBe('Call');
    p.destroy();
  });

  it('notifies from the page when no push could be booked', async () => {
    booked = false;
    const p = await callAt3();
    (p as unknown as Hidden).onHidden();
    vi.setSystemTime(new Date(2026, 8, 25, 14, 55, 30));
    p.tick();
    expect(notifyHidden).toHaveBeenCalledWith('Coming up at 3:00 pm', 'Call', expect.stringMatching(/^fixed-/));
    p.destroy();
  });

  it('can be switched off', async () => {
    const p = await callAt3();
    p.setSettings({ fixedLead: 0 });
    vi.setSystemTime(new Date(2026, 8, 25, 14, 58));
    p.tick();
    expect(p.comingUp).toBeNull();
    expect(chime).not.toHaveBeenCalled();
    p.destroy();
  });
});
