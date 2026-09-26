// App state and every user action. Days are immutable values: each action computes a new Day
// with the pure functions in actions.ts, then `commit` swaps it in and queues a write.

import * as A from './actions';
import { chime, notifyHidden, requestNotifications, unlockAudio, unlockOnFirstGesture, vibrate } from './alert';
import { download, parseBackup } from './backup';
import * as db from './db';
import { hasNotifications, needsInstallForNotifications } from './platform';
import { cancelPush, preparePush, schedulePush, unsubscribePush } from './push';
import { materialize, seriesFromItem, syncSeriesInto } from './repeat';
import { sampleItems } from './sample';
import { isActive, schedule, worked } from './schedule';
import { addDays, dayDiff, fT, hhmm, hm, keyDate, minutesInto, mondayOf, shortDate, todayKey } from './time';
import type { Day, Hue, Item, Kind, Series, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

export type Sheet =
  { type: 'task'; id: string } | { type: 'settings' } | { type: 'hours' } | { type: 'add' } | { type: 'install' };
export type ConfirmType = 'postpone' | 'delete' | 'clear' | 'erase' | 'sample';
export interface Confirm {
  type: ConfirmType;
  id: string;
  at: number;
}
export interface Resched {
  id: string;
  time: string;
  date: string;
}
export interface Drag {
  id: string;
  /** Index the task would be dropped before (null until the finger has moved). */
  over: number | null;
  /** How far the lifted task has moved from its place (px). */
  dy: number;
  /** Height of the lifted task's row: the gap the other rows open for it (px). */
  h: number;
}

export const CONFIRM_MS = 5000;
const SAVE_DELAY = 250;
const SERIES_DELAY = 500;
/** How far back to look for a timer left running on an earlier day. */
const RECENT_DAYS = 7;
export const THEME_KEY = 'elastic-day:theme';

type Msg = { t: 'days'; keys: string[] } | { t: 'settings' } | { t: 'series' } | { t: 'all' };

function readThemeMirror(): Settings['themePref'] {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'match') return v;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_SETTINGS.themePref;
}

const SERIES_FIELDS: (keyof Item)[] = ['title', 'min', 'kind', 'hue', 'fixedAt', 'note', 'repeat'];

export class Planner {
  ready = $state(false);
  failed = $state<string | null>(null);
  settings = $state.raw<Settings>({ ...DEFAULT_SETTINGS, themePref: readThemeMirror() });
  series = $state.raw<Series[]>([]);
  days = $state.raw<Record<string, Day>>({});
  today = $state(todayKey());
  viewKey = $state(todayKey());
  weekOff = $state(0);
  clock = $state(Date.now());

  sheet = $state<Sheet | null>(null);
  confirm = $state<Confirm | null>(null);
  resched = $state<Resched | null>(null);
  drag = $state<Drag | null>(null);
  hover = $state<string | null>(null);
  announce = $state('');
  importMsg = $state<{ err: boolean; t: string } | null>(null);
  /** The "get notified when time's up?" card, offered when a timer starts. */
  notifyPrompt = $state<'ask' | 'blocked' | null>(null);

  day: Day = $derived(this.days[this.viewKey] ?? this.blankDay(this.viewKey));
  isToday = $derived(this.viewKey === this.today);
  /** Now, in minutes since midnight of the viewed day. */
  n = $derived(minutesInto(this.viewKey, this.clock));
  sch = $derived(schedule(this.day, this.n));
  active = $derived(this.day.items.find(isActive) ?? null);
  /** A timer running or paused on a day other than the one on screen (e.g. left on last night). */
  elsewhere = $derived.by(() => {
    for (const d of Object.values(this.days)) {
      if (d.key === this.viewKey) continue;
      const it = d.items.find(isActive);
      if (it) return { key: d.key, it };
    }
    return null;
  });
  weekKeys = $derived.by(() => {
    const mon = addDays(mondayOf(this.today), this.weekOff * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  });

  private stored = new Set<string>();
  private pending = new Set<string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private seriesTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private alerted = new Set<string>();
  private bc: BroadcastChannel | null = null;
  private iv: ReturnType<typeof setInterval> | null = null;
  private nav = 0;
  private pushScheduled = false;

  // ---------- lifecycle ----------

  async init(): Promise<void> {
    try {
      const [s, series] = await Promise.all([db.getSettings(), db.getAllSeries()]);
      this.settings = { ...DEFAULT_SETTINGS, ...(s ?? {}), ...(s ? {} : { themePref: this.settings.themePref }) };
      this.series = series;
      await this.ensureDay(this.today);
      await Promise.all([this.loadWeek(), this.loadRecent()]);
      // Anything already over time when the page loads has had its alert.
      for (const d of Object.values(this.days))
        for (const it of d.items) if (isActive(it) && worked(it, minutesInto(d.key)) >= it.min) this.alerted.add(it.id);
      this.ready = true;
    } catch (e) {
      this.failed = e instanceof Error ? e.message : String(e);
      return;
    }
    this.iv = setInterval(() => this.tick(), 250);
    try {
      this.bc = new BroadcastChannel('elastic-day');
      this.bc.onmessage = (e) => void this.onMessage(e.data as Msg);
    } catch {
      /* no cross-tab sync */
    }
    if (typeof document === 'undefined') return;
    // After a reload a timer may already be running; the chime needs one user gesture first.
    unlockOnFirstGesture();
    if (this.settings.notify) void preparePush();
    addEventListener('pagehide', () => void this.flush());
    document.addEventListener('visibilitychange', () => (document.hidden ? this.onHidden() : this.onVisible()));
  }

  /** Going into the background: save, and have the push worker ring at time's up. */
  private onHidden(): void {
    void this.flush();
    const at = this.settings.notify ? this.timeUpAt() : null;
    if (at) this.pushScheduled = schedulePush(at);
  }

  private onVisible(): void {
    if (this.pushScheduled) cancelPush();
    this.pushScheduled = false;
    this.tick();
  }

  /** When the running timer (on any loaded day) reaches zero, in epoch ms; null if none is due. */
  private timeUpAt(): number | null {
    for (const d of Object.values(this.days)) {
      const it = d.items.find((i) => i.status === 'running');
      if (!it || this.alerted.has(it.id)) continue;
      const left = it.min - worked(it, minutesInto(d.key, this.clock));
      if (left > 0) return this.clock + left * 60000;
    }
    return null;
  }

  destroy(): void {
    if (this.iv) clearInterval(this.iv);
    this.bc?.close();
  }

  tick(): void {
    this.clock = Date.now();
    const tk = todayKey();
    if (tk !== this.today) this.rollover(tk);
    if (this.confirm && Date.now() - this.confirm.at > CONFIRM_MS) this.confirm = null;
    for (const d of Object.values(this.days)) {
      for (const it of d.items) {
        if (it.status !== 'running') continue;
        const over = worked(it, minutesInto(d.key, this.clock)) >= it.min;
        // Lengthening a task that already rang arms its alert again.
        if (!over) {
          this.alerted.delete(it.id);
          continue;
        }
        if (this.alerted.has(it.id)) continue;
        this.alerted.add(it.id);
        this.say(`Time's up for ${it.title}`);
        if (this.settings.alertOn) {
          chime();
          vibrate([180, 90, 180]);
        }
        // Same tag as the push worker's notification, so the two never show twice.
        if (this.settings.notify) notifyHidden("Time's up", it.title, 'timer-' + it.id);
      }
    }
  }

  /** Midnight passed with the app open. Follow it to the new day unless a timer is running. */
  private rollover(tk: string): void {
    const old = this.today;
    this.today = tk;
    this.weekOff = 0;
    void this.ensureDay(tk).then(() => this.loadWeek());
    if (this.viewKey === old && !this.days[old]?.items.some(isActive)) void this.switchDay(tk);
  }

  // ---------- loading & saving ----------

  private blankDay(key: string): Day {
    return materialize(key, this.series, this.settings.defStart, this.settings.defWrap, this.today);
  }

  /** Load a day from storage, or build it from repeating items (not stored until edited). */
  async ensureDay(key: string): Promise<Day> {
    const have = this.days[key];
    if (have) return have;
    const got = await db.getDay(key);
    if (this.days[key]) return this.days[key];
    if (got) this.stored.add(key);
    const d = got ?? this.blankDay(key);
    this.days = { ...this.days, [key]: d };
    return d;
  }

  async loadWeek(): Promise<void> {
    await Promise.all(this.weekKeys.map((k) => this.ensureDay(k)));
  }

  /** Load the last few stored days so a timer still running from one of them isn't lost. */
  private async loadRecent(): Promise<void> {
    const got = await db.getDays(addDays(this.today, -RECENT_DAYS), addDays(this.today, -1));
    const next = { ...this.days };
    for (const d of got) {
      if (next[d.key]) continue;
      next[d.key] = d;
      this.stored.add(d.key);
    }
    this.days = next;
  }

  private put(day: Day): void {
    this.days = { ...this.days, [day.key]: day };
    this.stored.add(day.key);
    this.pending.add(day.key);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.pending.size) return;
    const keys = [...this.pending];
    this.pending.clear();
    const days = keys.map((k) => this.days[k]).filter(Boolean);
    try {
      await db.putDays(days);
      this.post({ t: 'days', keys });
      void db.requestPersistence();
    } catch (e) {
      console.error('Could not save', e);
      keys.forEach((k) => this.pending.add(k));
    }
  }

  private post(m: Msg): void {
    try {
      this.bc?.postMessage(m);
    } catch {
      /* ignore */
    }
  }

  /** Another tab wrote something: reload what we have cached. */
  private async onMessage(m: Msg): Promise<void> {
    if (m.t === 'all') return this.reloadAll();
    if (m.t === 'settings') {
      const s = await db.getSettings();
      if (!s) return;
      const prev = this.settings;
      this.settings = { ...DEFAULT_SETTINGS, ...s };
      if (prev.defStart !== this.settings.defStart || prev.defWrap !== this.settings.defWrap) this.rebuildUnstored();
      return;
    }
    if (m.t === 'series') {
      this.series = await db.getAllSeries();
      this.rebuildUnstored();
      return;
    }
    for (const k of m.keys) {
      if (!(k in this.days)) continue;
      const d = await db.getDay(k);
      // Merge one key at a time, after the await, so edits made meanwhile aren't overwritten.
      if (d && !this.pending.has(k)) {
        this.days = { ...this.days, [k]: d };
        this.stored.add(k);
      }
    }
  }

  /** Days that exist only as templates get rebuilt after repeating items or defaults change. */
  private rebuildUnstored(): void {
    const next = { ...this.days };
    for (const k of Object.keys(next)) if (!this.stored.has(k)) next[k] = this.blankDay(k);
    this.days = next;
  }

  private async reloadAll(): Promise<void> {
    this.days = {};
    this.stored.clear();
    this.pending.clear();
    const [s, series] = await Promise.all([db.getSettings(), db.getAllSeries()]);
    this.settings = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
    this.series = series;
    this.sheet = null;
    this.confirm = null;
    this.resched = null;
    await this.ensureDay(this.viewKey);
    await this.ensureDay(this.today);
    await this.loadWeek();
  }

  // ---------- small helpers ----------

  say(m: string): void {
    this.announce = m;
  }

  item(id: string): Item | undefined {
    return A.find(this.day, id);
  }

  /** Apply a pure action to the viewed day and store the result. */
  private update(fn: (d: Day) => Day, msg?: string): void {
    const next = fn(this.day);
    if (next !== this.day) this.put(next);
    if (msg) this.say(msg);
  }

  /** Minutes since midnight of today (for defaults like a new fixed item's time). */
  nowToday(): number {
    return minutesInto(this.today, this.clock);
  }

  // ---------- navigation & UI state ----------

  async switchDay(key: string): Promise<void> {
    if (key === this.viewKey && this.days[key]) return;
    // Tapping through days quickly: only the last tap wins, whatever order the loads finish in.
    const nav = ++this.nav;
    await this.ensureDay(key);
    if (nav !== this.nav) return;
    this.fixBlankTitle();
    this.viewKey = key;
    this.sheet = null;
    this.confirm = null;
    this.resched = null;
    this.drag = null;
    this.hover = null;
    // Keep the week strip on the week of the day being shown (swiping can cross into the next).
    const week = Math.floor(dayDiff(mondayOf(this.today), key) / 7);
    if (week !== this.weekOff) {
      this.weekOff = week;
      void this.loadWeek();
    }
  }

  backToToday(): void {
    this.weekOff = 0;
    void this.switchDay(this.today).then(() => this.loadWeek());
  }

  shiftWeek(d: -1 | 1): void {
    this.weekOff += d;
    void this.loadWeek();
  }

  openSheet(s: Sheet): void {
    this.fixBlankTitle();
    this.sheet = s;
    this.confirm = null;
    this.importMsg = null;
    if (s.type === 'add') this.resched = null;
  }

  closeSheet(): void {
    this.fixBlankTitle();
    this.sheet = null;
    this.confirm = null;
  }

  /** A title cleared in the task sheet becomes "Untitled" once the sheet goes away. */
  private fixBlankTitle(): void {
    if (this.sheet?.type !== 'task') return;
    const it = this.item(this.sheet.id);
    if (it && !it.title.trim()) this.edit(it.id, { title: 'Untitled' });
  }

  arm(type: ConfirmType, id: string): void {
    this.confirm = { type, id, at: Date.now() };
  }

  armed(type: ConfirmType, id: string): boolean {
    return !!this.confirm && this.confirm.type === type && this.confirm.id === id;
  }

  disarm(): void {
    this.confirm = null;
  }

  // ---------- timer ----------

  startDay(): void {
    unlockAudio();
    const n = this.n;
    const first =
      this.day.items.find((i) => i.status === 'todo' && i.kind === 'task') ??
      this.day.items.find((i) => i.status === 'todo' && i.kind !== 'buffer');
    if (first) {
      this.alerted.delete(first.id);
      this.finishElsewhere();
    }
    this.update((d) => A.startDay(d, n), first ? `${first.title} started` : 'Day started');
    if (first) this.offerNotifications();
  }

  startItem(id: string): void {
    const it = this.item(id);
    if (!it || it.kind === 'buffer') return;
    unlockAudio();
    this.alerted.delete(id);
    this.confirm = null;
    this.finishElsewhere();
    this.update((d) => A.startItem(d, id, this.n), `${it.title} started`);
    this.offerNotifications();
  }

  /** Only one timer at a time across all days: finish one left running on another day. */
  private finishElsewhere(): void {
    const e = this.elsewhere;
    if (e) this.put(A.finish(this.days[e.key], e.it.id, minutesInto(e.key, this.clock)));
  }

  pause(id: string): void {
    const it = this.item(id);
    if (!it) return;
    const left = Math.max(0, (it.min - worked(it, this.n)) * 60);
    this.update(
      (d) => A.pause(d, id, this.n),
      `${it.title} paused, ${Math.floor(left / 60)} minutes ${Math.floor(left % 60)} seconds left`,
    );
  }

  resume(id: string): void {
    unlockAudio();
    this.update((d) => A.resume(d, id, this.n), `${this.item(id)?.title} resumed`);
  }

  finish(id: string): void {
    this.confirm = null;
    this.update((d) => A.finish(d, id, this.n), `${this.item(id)?.title} done`);
  }

  markDone(id: string, start: number, end: number): void {
    this.resched = null;
    this.update((d) => A.markDone(d, id, start, end), `${this.item(id)?.title} marked done`);
  }

  reopen(id: string): void {
    this.update((d) => A.reopen(d, id), `${this.item(id)?.title} reopened`);
  }

  skip(id: string): void {
    this.update((d) => A.skip(d, id), `${this.item(id)?.title} skipped`);
  }

  /** Restore a skipped item, or undo a move (removing the untouched copy from the other day). */
  async restore(id: string): Promise<void> {
    const it = this.item(id);
    if (!it) return;
    const key = this.viewKey;
    if (it.status === 'postponed' && it.movedKey && it.movedId) {
      const target = await this.ensureDay(it.movedKey);
      const copy = A.find(target, it.movedId);
      if (copy && copy.status === 'todo') this.put(A.remove(target, it.movedId));
    }
    const d = this.days[key];
    if (d) this.put(A.restore(d, id));
    this.say(`${it.title} restored`);
  }

  // ---------- postpone / reschedule ----------

  async postpone(id: string, where: 'later' | 'tomorrow'): Promise<void> {
    const it = this.item(id);
    if (!it) return;
    this.confirm = null;
    if (where === 'tomorrow') return this.moveToDay(id, addDays(this.today, 1), `${it.title} moved to tomorrow`);
    // A timer left running on an earlier day: "later today" means today, not that day.
    if (this.viewKey !== this.today && isActive(it))
      return this.moveToDay(id, this.today, `${it.title} moved to later today`);
    this.update((d) => A.postponeLater(d, id, this.n), `${it.title} moved to later today`);
  }

  openResched(id: string): void {
    let t = Math.ceil((this.n + 60) / 15) * 15;
    if (t > 1425) t = 1425;
    this.resched = { id, time: hhmm(t), date: addDays(this.today, 1) };
    this.confirm = null;
  }

  reschedNow(id: string): void {
    const it = this.item(id);
    if (!it) return;
    const res = A.reschedNow(this.day, id, this.n);
    this.resched = null;
    this.put(res.day);
    if (res.start) this.startItem(id);
    else this.say(`${it.title} is up next`);
  }

  reschedLater(id: string): void {
    const it = this.item(id);
    if (!it || !this.resched) return;
    const tm = Math.max(hm(this.resched.time), this.n);
    this.resched = null;
    this.update(
      (d) => A.reschedLater(d, id, tm, this.n),
      `${it.title} moved to around ${fT(tm, this.settings.clock24)}`,
    );
  }

  async moveToDay(id: string, key: string, msg?: string): Promise<void> {
    if (!key || key === this.viewKey) return;
    const src = this.viewKey;
    const res = A.moveOut(this.day, id, key, this.n);
    if (!res) return;
    this.resched = null;
    this.confirm = null;
    this.put(res.day);
    const target = await this.ensureDay(key);
    this.put(A.addItem(target, res.copy));
    if (this.viewKey !== src) return;
    this.say(msg ?? `${res.copy.title} moved to ${shortDate(keyDate(key))}`);
  }

  // ---------- editing ----------

  addTask(o: { title: string; min: number; kind: Kind; hue: Hue; fixedAt: number | null; repeat?: string }): void {
    const { repeat, ...fields } = o;
    const it = A.newItem({ ...fields, fixedAt: o.kind === 'fixed' ? o.fixedAt : null });
    this.sheet = null;
    this.update((d) => A.addItem(d, it), `Added ${it.title}`);
    // A repeating task becomes a series straight away, like choosing a repeat in the task sheet.
    if (repeat && repeat !== 'Once') void this.setRepeat(it.id, repeat);
  }

  /** Edit fields. Series fields on a repeating item also flow to later days not yet started. */
  edit(id: string, patch: Partial<Item>): void {
    const it = this.item(id);
    if (!it) return;
    this.update((d) => A.patchItem(d, id, patch));
    if (it.seriesId && Object.keys(patch).some((k) => SERIES_FIELDS.includes(k as keyof Item)))
      this.queueSeriesSync(it.seriesId, this.viewKey);
  }

  setKind(id: string, k: Kind): void {
    const it = this.item(id);
    this.update((d) => A.setKind(d, id, k));
    if (it?.seriesId) this.queueSeriesSync(it.seriesId, this.viewKey);
  }

  move(id: string, dir: -1 | 1): void {
    const it = this.item(id);
    const to = this.day.items.findIndex((i) => i.id === id) + dir;
    if (!it || to < 0 || to >= this.day.items.length) return;
    this.update((d) => A.move(d, id, dir), `Moved ${it.title} to position ${to + 1}`);
  }

  remove(id: string): void {
    const it = this.item(id);
    if (this.sheet?.type === 'task' && this.sheet.id === id) this.sheet = null;
    this.confirm = null;
    this.update((d) => A.remove(d, id), it ? `Deleted ${it.title}` : undefined);
  }

  toggleSub(id: string, sid: string): void {
    const it = this.item(id);
    if (!it) return;
    this.edit(id, { subtasks: it.subtasks.map((y) => (y.id === sid ? { ...y, d: !y.d } : y)) });
  }

  addSub(id: string, t: string): void {
    const it = this.item(id);
    if (!it || !t.trim()) return;
    this.edit(id, { subtasks: [...it.subtasks, { id: A.uid(), t: t.trim(), d: false }] });
    if (it.seriesId) this.queueSeriesSync(it.seriesId, this.viewKey);
  }

  removeSub(id: string, sid: string): void {
    const it = this.item(id);
    if (!it) return;
    this.edit(id, { subtasks: it.subtasks.filter((y) => y.id !== sid) });
    if (it.seriesId) this.queueSeriesSync(it.seriesId, this.viewKey);
  }

  async setRepeat(id: string, repeat: string): Promise<void> {
    const it = this.item(id);
    if (!it || it.repeat === repeat) return;
    if (repeat === 'Once') return this.stopRepeating(id);
    if (it.seriesId) {
      this.edit(id, { repeat });
      return;
    }
    const key = this.viewKey;
    const s = seriesFromItem({ ...it, repeat }, key, A.uid());
    this.series = [...this.series, s];
    this.update((d) => A.patchItem(d, id, { repeat, seriesId: s.id }));
    await db.putSeries(s);
    this.post({ t: 'series' });
    await this.propagate(s, null, s.id, key);
  }

  async stopRepeating(id: string): Promise<void> {
    const it = this.item(id);
    if (!it) return;
    const key = this.viewKey;
    const sid = it.seriesId;
    this.update((d) => A.patchItem(d, id, { repeat: 'Once', seriesId: null }), `${it.title} no longer repeats`);
    if (!sid) return;
    this.cancelSeriesSync(sid);
    const s = this.series.find((x) => x.id === sid);
    if (!s) return;
    const ended = { ...s, until: key };
    this.series = this.series.map((x) => (x.id === sid ? ended : x));
    await db.putSeries(ended);
    this.post({ t: 'series' });
    await this.propagate(ended, s, sid, key);
  }

  /** Series edits are batched: typing a title shouldn't rewrite every later day per keystroke. */
  private queueSeriesSync(sid: string, key: string): void {
    this.cancelSeriesSync(sid);
    this.seriesTimers.set(
      sid,
      setTimeout(() => {
        this.seriesTimers.delete(sid);
        void this.syncSeries(sid, key);
      }, SERIES_DELAY),
    );
  }

  private cancelSeriesSync(sid: string): void {
    const t = this.seriesTimers.get(sid);
    if (t) clearTimeout(t);
    this.seriesTimers.delete(sid);
  }

  /** Copy the edited item (on day `key`) back into its series and push the change to later days. */
  private async syncSeries(sid: string, key: string): Promise<void> {
    const it = this.days[key]?.items.find((i) => i.seriesId === sid);
    const old = this.series.find((x) => x.id === sid);
    if (!it || !old) return;
    const s: Series = { ...seriesFromItem(it, old.from, sid), until: old.until };
    this.series = this.series.map((x) => (x.id === sid ? s : x));
    await db.putSeries(s);
    this.post({ t: 'series' });
    await this.propagate(s, old, sid, key);
  }

  /** Apply a series change (`prev` → `next`) to stored days after `key` (never past days) not yet started. */
  private async propagate(next: Series, prev: Series | null, sid: string, key: string): Promise<void> {
    await this.flush();
    const after = addDays(key, 1);
    const from = after > this.today ? after : this.today;
    const later = new Map((await db.getDays(from, '9999-12-31')).map((d) => [d.key, d]));
    // Include stored days held in memory, and prefer them: they're never older than the database.
    for (const [k, d] of Object.entries(this.days)) if (k >= from && this.stored.has(k)) later.set(k, d);
    for (const d of later.values()) {
      if (d.dayStarted != null) continue;
      const synced = syncSeriesInto(d, next, prev, sid);
      if (synced !== d) this.put(synced);
    }
    this.rebuildUnstored();
  }

  // ---------- drag ----------

  dragMove(dy: number, over: number): void {
    if (this.drag && (this.drag.dy !== dy || this.drag.over !== over)) this.drag = { ...this.drag, dy, over };
  }

  commitDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.over == null) return;
    const it = this.item(d.id);
    const from = this.day.items.findIndex((i) => i.id === d.id);
    let to = d.over;
    if (to > from) to--;
    if (to === from) return;
    this.update((day) => A.reorder(day, d.id, d.over!), it ? `Moved ${it.title} to position ${to + 1}` : undefined);
  }

  // ---------- day ----------

  saveHours(start: number, wrap: number): void {
    this.sheet = null;
    this.update((d) => ({ ...d, dayStart: start, wrap }), 'Day hours saved');
  }

  clearDay(): void {
    this.confirm = null;
    this.update((d) => A.clearDay(d), 'Day cleared');
  }

  /** Replace the viewed day with the sample, planned from now (today) or the day's start. */
  loadSample(): void {
    this.confirm = null;
    this.sheet = null;
    const d = this.day;
    const start = this.isToday ? Math.max(d.dayStart, Math.ceil(this.n / 15) * 15) : d.dayStart;
    this.put({ ...d, dayStart: start, dayStarted: null, items: sampleItems(start) });
    this.say('Sample day loaded');
  }

  // ---------- settings & data ----------

  setSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    if ('defStart' in patch || 'defWrap' in patch) this.rebuildUnstored();
    if ('themePref' in patch) {
      try {
        localStorage.setItem(THEME_KEY, this.settings.themePref);
      } catch {
        /* storage blocked */
      }
    }
    void db.putSettings(this.settings).then(() => this.post({ t: 'settings' }));
  }

  async exportData(): Promise<void> {
    await this.flush();
    const [days, series] = await Promise.all([db.getAllDays(), db.getAllSeries()]);
    download({
      app: 'elastic-day',
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      series,
      days,
    });
  }

  async importFile(file: File): Promise<void> {
    const res = parseBackup(await file.text());
    if ('error' in res) {
      this.importMsg = { err: true, t: res.error };
      return;
    }
    if (res.kind === 'day') {
      this.put({ ...this.day, items: res.items, dayStart: res.dayStart, wrap: res.wrap });
      this.importMsg = { err: false, t: 'Imported. Your plan has been replaced with the backup.' };
      return;
    }
    await db.replaceAll({ days: res.days, series: res.series, settings: res.settings });
    try {
      localStorage.setItem(THEME_KEY, res.settings.themePref);
    } catch {
      /* storage blocked */
    }
    await this.reloadAll();
    this.post({ t: 'all' });
    this.importMsg = { err: false, t: 'Imported. Everything has been replaced with the backup.' };
  }

  async eraseAll(): Promise<void> {
    this.confirm = null;
    await db.replaceAll({ days: [], series: [], settings: null });
    try {
      localStorage.removeItem(THEME_KEY);
    } catch {
      /* storage blocked */
    }
    this.alerted.clear();
    this.viewKey = this.today;
    this.weekOff = 0;
    await this.reloadAll();
    this.post({ t: 'all' });
    this.say('Everything erased');
  }

  // ---------- notifications ----------

  /** After a timer starts, suggest notifications unless they're on, refused, or snoozed. */
  private offerNotifications(): void {
    const s = this.settings;
    if (s.notify || s.notifyAsk === 'never' || (s.notifyAskAfter && this.today < s.notifyAskAfter)) return;
    if (!hasNotifications() && !needsInstallForNotifications()) return;
    if (hasNotifications() && Notification.permission === 'denied') return;
    this.notifyPrompt = 'ask';
  }

  /** The three answers on the suggestion card. */
  async answerNotifyPrompt(a: 'on' | 'later' | 'never'): Promise<void> {
    if (a === 'on') {
      const ok = await this.enableNotifications();
      this.notifyPrompt = ok ? null : 'blocked';
      return;
    }
    this.notifyPrompt = null;
    if (a === 'later') this.setSettings({ notifyAskAfter: addDays(this.today, 1) });
    else this.setSettings({ notifyAsk: 'never', notify: false });
  }

  /** Ask the browser for permission (must run from a tap) and switch notifications on. */
  async enableNotifications(): Promise<boolean> {
    const perm = await requestNotifications();
    if (perm !== 'granted') {
      this.setSettings({ notify: false });
      return false;
    }
    this.setSettings({ notify: true, notifyAskAfter: null });
    await preparePush();
    this.say('Notifications on');
    return true;
  }

  disableNotifications(): void {
    // Turning them off in Settings is a clear answer: don't suggest them again.
    this.setSettings({ notify: false, notifyAsk: 'never' });
    void unsubscribePush();
    this.say('Notifications off');
  }
}

export const planner = new Planner();
