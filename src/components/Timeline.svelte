<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { timelineRows } from '../lib/rows';
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
      drag: P.drag,
    }),
  );
</script>

<ol class="timeline" bind:this={listEl} aria-label="Plan for the day">
  {#each rows as r (r.key)}
    {#if r.type === 'item'}
      <ItemRow v={r} list={() => listEl} />
    {:else if r.type === 'gap'}
      <li class="gap">
        <span></span>
        <span class="gline"><span></span></span>
        <span class="gtext"><span>{r.gap}</span> unaccounted for</span>
      </li>
    {:else if r.type === 'drop'}
      <li class="drop" aria-hidden="true"></li>
    {:else}
      <li class="now" aria-label="Now"><NowLine /></li>
    {/if}
  {/each}
</ol>

<style>
  .timeline {
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
  .drop {
    height: 3px;
    border-radius: 3px;
    background: #fb923c;
    margin: 0 0 0 var(--tc);
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
