<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { keyDate, shortDate } from '../lib/time';
  import DisarmBar from './DisarmBar.svelte';

  const count = $derived(P.day.items.length);
  const tasks = $derived(`${count} task${count === 1 ? '' : 's'}`);
  const dateLabel = $derived(shortDate(keyDate(P.viewKey)));
  const armed = $derived(P.armed('clear', 'day'));
  const started = $derived(P.isToday && P.day.dayStarted != null);
</script>

{#if started}
  <div class="end-row">
    {#if P.day.dayEnded == null}
      <!-- The evening's colours, where Start my day has the day's. -->
      <button class="end-day" onclick={() => P.openSheet({ type: 'wrapup' })}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
          ><path d="M10.6 1.6A6.6 6.6 0 1 0 14.4 11 5.4 5.4 0 0 1 10.6 1.6Z" /></svg
        >End my day
      </button>
    {:else}
      <button class="reopen" onclick={() => P.reopenDay()}>Reopen day</button>
    {/if}
  </div>
{/if}

<!-- An ended day is a record: nothing to clear. -->
{#if count && !P.locked}
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
  .end-row {
    display: flex;
    justify-content: center;
    padding: 28px var(--px) 8px;
  }
  .end-day {
    height: 44px;
    padding: 0 22px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: linear-gradient(90deg, #fdba74, #fb7185, #e879f9, #a78bfa, #60a5fa);
    color: #16181d;
    font: 400 15px/1 var(--font);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 8px 22px -10px rgba(15, 23, 42, 0.45);
    transition: filter 200ms;
  }
  .end-day svg {
    fill: currentColor;
  }
  @media (hover: hover) {
    .end-day:hover {
      filter: saturate(1.15) brightness(1.04);
    }
  }
  .reopen {
    height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 400 15px/1 var(--font);
    cursor: pointer;
  }
  .clear {
    margin: 20px var(--px) 24px;
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
