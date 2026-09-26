<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { dragShifts, timelineRows } from '../lib/rows';
  import ItemRow from './ItemRow.svelte';
  import NowLine from './NowLine.svelte';

  let listEl: HTMLOListElement | null = $state(null);

  const showTimes = $derived(
    !P.isToday || P.settings.showTimes === 'always' || (P.settings.showTimes === 'started' && P.day.dayStarted != null),
  );
  const rows = $derived(
    timelineRows({
      day: P.day,
      rows: P.sch.rows,
      n: P.n,
      isToday: P.isToday,
      showTimes,
      clock24: P.settings.clock24,
    }),
  );
  // While a task is dragged, the rows between its old and new place slide to open a gap.
  const shifts = $derived(dragShifts(rows, P.drag, P.day.items.length));
  const moved = (key: string) => (shifts[key] ? `translateY(${shifts[key]}px)` : undefined);
</script>

<ol class="timeline" class:sorting={!!P.drag} bind:this={listEl} aria-label="Plan for the day">
  {#each rows as r (r.key)}
    {#if r.type === 'item'}
      <ItemRow v={r} list={() => listEl} shift={shifts[r.key] ?? 0} />
    {:else if r.type === 'gap'}
      <li class="gap" style:transform={moved(r.key)}>
        <span></span>
        <span class="gline"><span></span></span>
        <span class="gtext"><span>{r.gap}</span> unaccounted for</span>
      </li>
    {:else}
      <li class="now" aria-label="Now" style:transform={moved(r.key)}><NowLine /></li>
    {/if}
  {/each}
</ol>

<style>
  .timeline {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 10px var(--px) 12px;
    display: flex;
    flex-direction: column;
  }
  .gap {
    display: grid;
    grid-template-columns: var(--tc) var(--sc) minmax(0, 1fr);
    min-height: 30px;
    align-items: center;
  }
  .gline {
    align-self: stretch;
    display: flex;
    justify-content: center;
  }
  .gline span {
    border-left: 2px dotted var(--faint);
    opacity: 0.7;
  }
  .gtext {
    font: 400 12px/1 var(--font);
    color: var(--faint);
    padding-left: 12px;
  }
  .gtext span {
    color: var(--orT);
  }
  /* Rows glide out of the way while a task is dragged (the lifted row follows the finger). */
  .sorting > :global(li:not(.lifted)) {
    transition: transform 180ms ease;
  }
  .now {
    display: grid;
    grid-template-columns: var(--tc) minmax(0, 1fr);
    align-items: center;
    height: 22px;
    position: relative;
    z-index: 2;
  }
</style>
