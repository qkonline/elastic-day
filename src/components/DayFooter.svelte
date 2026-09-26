<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { keyDate, shortDate } from '../lib/time';
  import DisarmBar from './DisarmBar.svelte';

  const count = $derived(P.day.items.length);
  const tasks = $derived(`${count} task${count === 1 ? '' : 's'}`);
  const dateLabel = $derived(shortDate(keyDate(P.viewKey)));
  const armed = $derived(P.armed('clear', 'day'));
</script>

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
