// Times of day are minutes since local midnight of the item's day (540 = 9:00 am).
// Timer timestamps use the same unit, can be fractional, and can exceed 1440 when a
// task runs past midnight. Start/end times are never stored: see schedule.ts.

export type Hue = 'orange' | 'yellow' | 'lime' | 'cyan' | 'indigo';
export type Kind = 'task' | 'buffer' | 'fixed';
export type Status = 'todo' | 'running' | 'paused' | 'done' | 'postponed' | 'skipped';
export type Repeat = string; // 'Once' | 'Every day' | 'Weekdays' | `Every ${Weekday}`
export type ThemePref = 'match' | 'light' | 'dark';
export type ShowTimes = 'started' | 'always' | 'never';

export interface Subtask {
  id: string;
  t: string;
  d: boolean;
}

export interface Item {
  id: string;
  title: string;
  min: number;
  kind: Kind;
  fixedAt: number | null;
  hue: Hue;
  status: Status;
  startedAt: number | null;
  endedAt: number | null;
  pausedAt: number | null;
  pausedFor: number;
  repeat: Repeat;
  seriesId: string | null;
  subtasks: Subtask[];
  note: string;
  /** Set by "Mark done" on a missed item; never timed. */
  marked?: boolean;
  /** The remainder copy created by "Postpone → Later today" mid-task. */
  continued?: boolean;
  /** On the original item when its remainder went to later today. */
  laterCopy?: boolean;
  /** Day this item was moved to, and the id of the copy there (for Undo). */
  movedKey?: string | null;
  movedId?: string | null;
}

export interface Day {
  key: string;
  dayStart: number;
  wrap: number;
  dayStarted: number | null;
  items: Item[];
}

export interface Settings {
  themePref: ThemePref;
  clock24: boolean;
  showTimes: ShowTimes;
  /** Chime and vibration at time's up. */
  alertOn: boolean;
  /** System notifications at time's up (needs the browser's permission too). */
  notify: boolean;
  /** Whether starting a timer may suggest turning notifications on. */
  notifyAsk: 'ask' | 'never';
  /** Day key before which the suggestion stays hidden ("Not now" = tomorrow). */
  notifyAskAfter: string | null;
  defStart: number;
  defWrap: number;
}

/** Template for a repeating item. Day items point at it through `seriesId`. */
export interface Series {
  id: string;
  title: string;
  min: number;
  kind: Kind;
  hue: Hue;
  fixedAt: number | null;
  repeat: Repeat;
  note: string;
  subtasks: { id: string; t: string }[];
  /** First day key the series applies to. */
  from: string;
  /** Day key after which it stops (set by "Stop repeating"), or null while active. */
  until: string | null;
}

export const HUES: Record<Hue, string> = {
  orange: '#fb923c',
  yellow: '#fde047',
  lime: '#a3e635',
  cyan: '#22d3ee',
  indigo: '#818cf8',
};

export const DEFAULT_SETTINGS: Settings = {
  themePref: 'match',
  clock24: false,
  showTimes: 'started',
  alertOn: true,
  notify: false,
  notifyAsk: 'ask',
  notifyAskAfter: null,
  defStart: 540,
  defWrap: 1020,
};
