// IndexedDB persistence. One record per day (keyed 'YYYY-MM-DD'), one per repeating series,
// and in `meta` the settings and the booked notifications. Everything stays in this browser.

import type { AlertGroup } from './reminders';
import type { Day, Series, Settings } from './types';

const DB_NAME = 'elastic-day';
const VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('series')) db.createObjectStore('series', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgraded the schema: let it proceed, reopen lazily next time.
      db.onversionchange = () => {
        db.close();
        dbp = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Elastic Day is open in another tab that is blocking an upgrade.'));
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const txDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });

async function store(name: 'days' | 'series' | 'meta', mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

// JSON round-trip strips Svelte state proxies and anything non-cloneable before storing.
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export async function getDay(key: string): Promise<Day | undefined> {
  return done((await store('days', 'readonly')).get(key));
}

export async function getDays(from: string, to: string): Promise<Day[]> {
  return done((await store('days', 'readonly')).getAll(IDBKeyRange.bound(from, to)));
}

export async function getAllDays(): Promise<Day[]> {
  return done((await store('days', 'readonly')).getAll());
}

export async function putDays(days: Day[]): Promise<void> {
  if (!days.length) return;
  const db = await open();
  const tx = db.transaction('days', 'readwrite');
  for (const d of days) tx.objectStore('days').put(plain(d));
  return txDone(tx);
}

export const putDay = (day: Day) => putDays([day]);

export async function deleteDay(key: string): Promise<void> {
  await done((await store('days', 'readwrite')).delete(key));
}

export async function getAllSeries(): Promise<Series[]> {
  return done((await store('series', 'readonly')).getAll());
}

export async function putSeries(s: Series): Promise<void> {
  await done((await store('series', 'readwrite')).put(plain(s)));
}

export async function getSettings(): Promise<Partial<Settings> | undefined> {
  return done((await store('meta', 'readonly')).get('settings'));
}

export async function putSettings(s: Settings): Promise<void> {
  await done((await store('meta', 'readwrite')).put(plain(s), 'settings'));
}

/** The notifications booked with the push worker, for the service worker to show (see reminders.ts). */
export async function putAlerts(groups: AlertGroup[]): Promise<void> {
  await done((await store('meta', 'readwrite')).put(plain({ groups }), 'alerts'));
}

/** Replace everything in one transaction (Import) or wipe it (Erase everything). */
export async function replaceAll(data: { days: Day[]; series: Series[]; settings: Settings | null }): Promise<void> {
  const db = await open();
  const tx = db.transaction(['days', 'series', 'meta'], 'readwrite');
  tx.objectStore('days').clear();
  tx.objectStore('series').clear();
  tx.objectStore('meta').clear();
  for (const d of data.days) tx.objectStore('days').put(plain(d));
  for (const s of data.series) tx.objectStore('series').put(plain(s));
  if (data.settings) tx.objectStore('meta').put(plain(data.settings), 'settings');
  return txDone(tx);
}

/** Close the connection (tests swap in a fresh database between cases). */
export async function closeDb(): Promise<void> {
  if (!dbp) return;
  const db = await dbp.catch(() => null);
  db?.close();
  dbp = null;
}

/** Ask the browser not to evict our data under storage pressure. Best effort. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
