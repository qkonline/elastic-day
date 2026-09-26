<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { hhmm, hm, keyDate, shortDate } from '../lib/time';
  import type { Hue, Kind } from '../lib/types';
  import Fields, { KINDS } from './Fields.svelte';

  let title = $state('');
  let minText = $state('30');
  let kind = $state<Kind>('task');
  let hue = $state<Hue | null>(null);
  // Fixed items default to the next quarter hour, half an hour from now.
  const defaultFixed = (Math.ceil((P.nowToday() + 30) / 15) * 15) % 1440;
  let fixedStr = $state(hhmm(defaultFixed));

  const min = $derived(parseInt(minText) || 0);
  const ok = $derived(!!title.trim() && min > 0);
  const sel = $derived(hue ?? (kind === 'fixed' ? 'indigo' : 'cyan'));
  const placeholder = $derived(P.isToday ? 'What else today?' : `What else on ${shortDate(keyDate(P.viewKey))}?`);

  function add() {
    if (!ok) return;
    const fixedAt = kind === 'fixed' ? (fixedStr ? hm(fixedStr) : defaultFixed) : null;
    P.addTask({ title: title.trim(), min: Math.max(1, min), kind, hue: sel, fixedAt });
  }
  const enter = (e: KeyboardEvent) => e.key === 'Enter' && !e.isComposing && add();
</script>

<div class="head">
  <span class="h">New task</span>
  <button class="close-x" aria-label="Close" onclick={() => P.closeSheet()}>×</button>
</div>
<div class="body">
  <input class="name" data-autofocus bind:value={title} onkeydown={enter} {placeholder} aria-label="Task name" />
  <Fields
    field="duration"
    {min}
    {minText}
    onMin={(m) => (minText = String(m))}
    onMinText={(s) => (minText = s)}
    onEnter={add}
  />
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
  {#if kind !== 'buffer'}
    <Fields field="colour" hue={sel} onHue={(h) => (hue = h)} ringBg="var(--bg)" />
  {/if}
</div>
<div class="foot">
  <span class="note">
    {kind === 'fixed'
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
    padding: 6px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .name {
    height: 52px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--raised);
    padding: 0 14px;
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
