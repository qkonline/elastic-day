<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { dL, fNZ, fT, keyDate, shortDate } from '../lib/time';
  import DisarmBar from './DisarmBar.svelte';

  const c24 = $derived(P.settings.clock24);
  const d = $derived(P.day);
  // A time after midnight belongs to the night after this day.
  const late = (m: number) => (m >= 1440 ? ' (next day)' : '');
  const flexWaiting = $derived(P.settings.flexStart && P.isToday && d.dayStarted == null);
  const count = $derived(P.day.items.length);
  const tasks = $derived(`${count} task${count === 1 ? '' : 's'}`);
  const dateLabel = $derived(shortDate(keyDate(P.viewKey)));
  const armed = $derived(P.armed('clear', 'day'));
</script>

<div class="hours">
  <span class="hrs">
    <span class="line">
      {#if d.dayEnded != null && d.dayStarted != null}
        Day <span class="val">{fNZ(d.dayStarted, c24)} – {fT(d.dayEnded, c24)}{late(d.dayEnded)}</span>
      {:else if d.dayStarted != null}
        Started <span class="val">{fNZ(d.dayStarted, c24)}</span>, wrap up by
        <span class="val">{fT(d.wrap, c24)}{late(d.wrap)}</span>
      {:else if flexWaiting}
        Your day: <span class="val">{dL(P.settings.dayLength)} from Start my day</span>
      {:else}
        Day <span class="val">{fT(d.dayStart, c24)} – {fT(d.wrap, c24)}{late(d.wrap)}</span>
      {/if}
    </span>
    <button
      class="edit hit"
      style:--hit-x="4px"
      style:--hit-y="4px"
      aria-label="Edit day hours"
      onclick={() => P.openSheet({ type: 'hours' })}>✎</button
    >
  </span>
</div>

{#if count}
  <div class="clear">
    {#if armed}
      <div class="armed" role="group" aria-label="Confirm clear">
        <span class="q"
          >Remove all {tasks} from {P.isToday ? 'today' : dateLabel}? <span>This can't be undone.</span></span
        >
        <button class="yes" onclick={() => P.clearDay()} {@attach (el) => el.focus()}>Clear</button>
        <button class="no" onclick={() => P.disarm()}>Cancel</button>
        <DisarmBar />
      </div>
    {:else}
      <div class="text">
        <span class="t">Clear this day</span>
        <span class="hint"
          >Removes all {tasks} from {dateLabel} and resets its timers. Your settings and other days aren't affected.</span
        >
      </div>
      <button class="btn" onclick={() => P.arm('clear', 'day')}>Clear all tasks</button>
    {/if}
  </div>
{/if}

<style>
  .hours {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 18px;
    padding: 16px var(--px) 20px;
    font: 400 13px/1 var(--font);
    color: var(--muted);
  }
  .hrs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
  .line {
    line-height: 1.5;
  }
  .val {
    color: var(--text);
  }
  .edit {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--muted);
    font: 400 15px/1 var(--font);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .clear {
    margin: 0 var(--px) 24px;
    padding: 18px 0 0;
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
  }
  .text {
    flex: 1 1 240px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .t {
    font: 400 15px/1.3 var(--font);
  }
  .hint {
    font: 400 13px/1.45 var(--font);
    color: var(--muted);
    text-wrap: pretty;
  }
  .btn {
    height: 48px;
    flex: 1 1 100%;
    padding: 0 18px;
    border-radius: 12px;
    border: 1px solid rgba(248, 113, 113, 0.6);
    background: transparent;
    color: var(--redT);
    font: 400 15px/1 var(--font);
    cursor: pointer;
  }
  @media (min-width: 768px) {
    .btn {
      height: 44px;
      flex: none;
    }
  }
  .armed {
    flex: 1 1 100%;
    padding: 14px;
    border-radius: 14px;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.4);
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  .q {
    flex: 1 1 200px;
    font: 400 14px/1.4 var(--font);
  }
  .q span {
    color: var(--muted);
  }
  .yes,
  .no {
    height: 44px;
    border-radius: 12px;
    font: 400 14px/1 var(--font);
    cursor: pointer;
  }
  .yes {
    padding: 0 18px;
    border: none;
    background: #f87171;
    color: #16181d;
  }
  .no {
    padding: 0 16px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
  }
</style>
