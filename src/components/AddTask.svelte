<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { clockToDay, hhmm, hm, keyDate, shortDate, weekdayLong } from '../lib/time';
  import type { Hue, Kind } from '../lib/types';
  import Fields, { KINDS } from './Fields.svelte';

  let title = $state('');
  let min = $state(30);
  let kind = $state<Kind>('task');
  let hue = $state<Hue | null>(null);
  let repeat = $state('Once');
  const repeats = $derived(['Once', 'Every day', 'Weekdays', 'Every ' + weekdayLong(keyDate(P.viewKey))]);
  // Fixed items default to the next quarter hour, half an hour from now (after midnight on a
  // late day, that's still this day).
  const defaultFixed = Math.ceil((P.nowToday() + 30) / 15) * 15;
  let fixedStr = $state(hhmm(defaultFixed));
  // "No time": a check, ticked off on the checklist instead of timed.
  const isCheck = $derived(min === 0);
  const late = $derived(Math.max(P.day.wrap, P.isToday ? P.n : 0));

  const ok = $derived(!!title.trim());
  const sel = $derived(hue ?? (kind === 'fixed' ? 'indigo' : 'cyan'));
  const placeholder = $derived(P.isToday ? 'What else today?' : `What else on ${shortDate(keyDate(P.viewKey))}?`);

  function add() {
    if (!ok) return;
    const k = isCheck ? 'check' : kind;
    const fixedAt = k === 'fixed' ? (fixedStr ? clockToDay(hm(fixedStr), late) : defaultFixed) : null;
    P.addTask({ title: title.trim(), min: isCheck ? 0 : Math.max(1, min), kind: k, hue: sel, fixedAt, repeat });
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
  <Fields field="duration" {min} allowNone onMin={(m) => (min = m)} />
  {#if !isCheck}
    <div class="group">
      <span class="label">Kind</span>
      <div class="row">
        {#each KINDS as [k, l] (k)}
          <button class="chip" aria-pressed={kind === k} onclick={() => (kind = k)}>{l}</button>
        {/each}
        {#if kind === 'fixed'}
          <input class="time" type="time" aria-label="Time" bind:value={fixedStr} />
        {/if}
      </div>
    </div>
  {/if}
  <div class="group">
    <span class="label">Repeats</span>
    <div class="row">
      {#each repeats as r (r)}
        <button class="chip" aria-pressed={repeat === r} onclick={() => (repeat = r)}>{r}</button>
      {/each}
    </div>
    {#if repeat !== 'Once'}
      <span class="hint">It'll also be added to the matching days after this one.</span>
    {/if}
  </div>
  {#if isCheck || kind !== 'buffer'}
    <Fields field="colour" hue={sel} onHue={(h) => (hue = h)} ringBg="var(--bg)" />
  {/if}
</div>
<div class="foot">
  <span class="note">
    {isCheck
      ? "Goes on your checklist. Tick it off when it's done."
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
  .hint {
    font: 400 12px/1.4 var(--font);
    color: var(--muted);
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
