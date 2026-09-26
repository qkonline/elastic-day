<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import { planner as P } from '../lib/planner.svelte';
  import { clockToDay, hhmm, hm, keyDate, shortDate, weekdayLong } from '../lib/time';
  import type { Hue, Kind } from '../lib/types';
  import { reducedMotion } from '../lib/ui.svelte';
  import Fields, { KINDS } from './Fields.svelte';

  // The name, type and colour are always shown. Timing and repeating are optional, each behind
  // a switch that opens its choices in place. Without timing, a task is a check: ticked off on
  // the checklist instead of timed.
  let title = $state('');
  let kind = $state<Kind>('task');
  let hue = $state<Hue | null>(null);
  let timed = $state(true);
  let min = $state(30);
  let repeats = $state(false);
  let repeat = $state('Every day');
  const repeatOpts = $derived(['Every day', 'Weekdays', 'Every ' + weekdayLong(keyDate(P.viewKey))]);
  // Fixed items default to the next quarter hour, half an hour from now (after midnight on a
  // late day, that's still this day).
  const defaultFixed = Math.ceil((P.nowToday() + 30) / 15) * 15;
  let fixedStr = $state(hhmm(defaultFixed));
  const late = $derived(Math.max(P.day.wrap, P.isToday ? P.n : 0));

  const ok = $derived(!!title.trim());
  const sel = $derived(hue ?? (kind === 'fixed' ? 'indigo' : 'cyan'));
  const placeholder = $derived(P.isToday ? 'What else today?' : `What else on ${shortDate(keyDate(P.viewKey))}?`);
  const unfold = () => ({ duration: reducedMotion.current ? 0 : 220, easing: cubicOut });

  // Buffers and fixed items always take time, so picking one turns timing on, and turning
  // timing off makes it a plain task.
  function setKind(k: Kind) {
    kind = k;
    if (k !== 'task') timed = true;
  }
  function setTimed(on: boolean) {
    timed = on;
    if (!on) kind = 'task';
  }

  function add() {
    if (!ok) return;
    const k = timed ? kind : 'check';
    const fixedAt = k === 'fixed' ? (fixedStr ? clockToDay(hm(fixedStr), late) : defaultFixed) : null;
    P.addTask({
      title: title.trim(),
      min: timed ? Math.max(1, min) : 0,
      kind: k,
      hue: sel,
      fixedAt,
      repeat: repeats ? repeat : 'Once',
    });
  }
  const enter = (e: KeyboardEvent) => e.key === 'Enter' && !e.isComposing && add();
</script>

<div class="head">
  <span class="h">New task</span>
  <button class="close-x" aria-label="Close" onclick={() => P.closeSheet()}>×</button>
</div>
<div class="body">
  <input
    class="name large-text"
    data-autofocus
    bind:value={title}
    onkeydown={enter}
    {placeholder}
    aria-label="Task name"
  />

  <div class="group">
    <span class="label">Type</span>
    <div class="row">
      {#each KINDS as [k, l] (k)}
        <button class="chip" aria-pressed={kind === k} onclick={() => setKind(k)}>{l}</button>
      {/each}
    </div>
    {#if kind === 'fixed'}
      <label class="at" transition:slide={unfold()}>
        <span>At</span>
        <input class="time" type="time" aria-label="Time" bind:value={fixedStr} />
      </label>
    {/if}
  </div>

  {#if kind !== 'buffer'}
    <div transition:slide={unfold()}>
      <Fields field="colour" hue={sel} onHue={(h) => (hue = h)} ringBg="var(--bg)" />
    </div>
  {/if}

  <div class="props">
    <div class="prop">
      <button class="toggle" role="switch" aria-checked={timed} onclick={() => setTimed(!timed)}>
        <span class="tt">
          <span class="tn">Timed</span>
          <span class="ts">{timed ? 'Start, pause and finish it with a timer' : 'No timer, just a box to tick'}</span>
        </span>
        <span class="switch" class:on={timed}><span></span></span>
      </button>
      {#if timed}
        <div class="more" transition:slide={unfold()}>
          <Fields field="duration" {min} showLabel={false} onMin={(m) => (min = m)} />
        </div>
      {/if}
    </div>
    <div class="prop">
      <button class="toggle" role="switch" aria-checked={repeats} onclick={() => (repeats = !repeats)}>
        <span class="tt">
          <span class="tn">Repeats</span>
          <span class="ts">{repeats ? 'Also added to the matching days after this one' : 'Just this once'}</span>
        </span>
        <span class="switch" class:on={repeats}><span></span></span>
      </button>
      {#if repeats}
        <div class="more" transition:slide={unfold()}>
          <div class="row">
            {#each repeatOpts as r (r)}
              <button class="chip" aria-pressed={repeat === r} onclick={() => (repeat = r)}>{r}</button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
<div class="foot">
  <span class="note">
    {!timed
      ? 'Goes on your checklist, above the timeline.'
      : kind === 'fixed'
        ? 'Sits at its set time; the rest of the day flows around it.'
        : 'Goes to the end of the day. Drag it to reorder.'}
  </span>
  <button class="cancel" onclick={() => P.closeSheet()}>Cancel</button>
  <button class="add" class:ok disabled={!ok} onclick={add}>Add task</button>
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 6px;
  }
  .h {
    flex: 1;
    font: 400 20px/1.2 var(--font);
    letter-spacing: -0.01em;
  }
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  /* When the keyboard leaves little room, scroll the form rather than squash its fields. */
  .body > :global(*) {
    flex-shrink: 0;
  }
  .name {
    height: 56px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--raised);
    padding: 0 18px;
    font: 400 17px/1 var(--font);
    color: var(--text);
    outline: none;
    box-sizing: border-box;
    width: 100%;
  }
  .name:focus-visible {
    border-color: var(--muted);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .at {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 400 14px/1 var(--font);
    color: var(--muted);
  }
  /* Optional properties: one card, a row per switch, choices unfolding under their row. */
  .props {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--raised);
    overflow: hidden;
  }
  .prop + .prop {
    border-top: 1px solid var(--border);
  }
  .toggle {
    width: 100%;
    min-height: 64px;
    padding: 12px 14px 12px 16px;
    border: none;
    background: transparent;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    cursor: pointer;
  }
  .toggle:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: -4px;
    border-radius: 12px;
  }
  .tt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tn {
    font: 400 15px/1.2 var(--font);
  }
  .ts {
    font: 400 13px/1.35 var(--font);
    color: var(--muted);
    text-wrap: pretty;
  }
  .more {
    padding: 0 16px 16px;
  }
  .time {
    height: 40px;
    padding: 0 8px;
    border-radius: 10px;
    border: none;
    background: var(--sunk);
    color: var(--text);
    font: 400 14px/1 var(--font);
  }
  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px calc(26px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
  }
  /* Keyboard up: every pixel counts, and the home indicator is hidden behind it anyway. */
  :global(.keyboard-open) .foot {
    padding-bottom: 12px;
    justify-content: flex-end;
  }
  :global(.keyboard-open) .note {
    display: none;
  }
  .note {
    flex: 1;
    min-width: 0;
    font: 400 12px/1.4 var(--font);
    color: var(--muted);
    text-wrap: pretty;
  }
  .cancel {
    height: 48px;
    padding: 0 14px;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: var(--muted);
    font: 400 15px/1 var(--font);
    cursor: pointer;
  }
  .add {
    height: 48px;
    padding: 0 22px;
    border-radius: 12px;
    border: none;
    background: var(--sunk);
    color: var(--faint);
    font: 400 15px/1 var(--font);
    cursor: default;
    white-space: nowrap;
    transition:
      background 240ms,
      color 240ms;
  }
  .add.ok {
    background: #334155;
    color: #f8fafc;
    cursor: pointer;
  }
</style>
