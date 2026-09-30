<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import { planner as P } from '../lib/planner.svelte';
  import { reducedMotion } from '../lib/ui.svelte';

  // Today's plan waits here until the day is started; the tasks' Start buttons and the
  // checklist stay off until then (so a day of only checks needs it too). Once pressed, the row
  // folds away and the tasks slide up into its place.
  const show = $derived(
    P.isToday && P.day.dayStarted == null && P.day.items.some((i) => i.status === 'todo' && i.kind !== 'buffer'),
  );
  const fold = () => ({ duration: reducedMotion.current ? 0 : 280, easing: cubicOut });
</script>

{#if show}
  <div class="start-row" transition:slide={fold()}>
    <button class="start-day" onclick={() => P.startDay()}><span>▶</span>Start my day</button>
  </div>
{/if}

<style>
  .start-row {
    display: flex;
    justify-content: center;
    padding: 14px var(--px) 4px;
  }
  /* The same five colours as the task palette, which also ring the Add task button. */
  .start-day {
    height: 44px;
    padding: 0 22px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: linear-gradient(90deg, #fb923c, #fde047, #a3e635, #22d3ee, #818cf8);
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
  .start-day span {
    font-size: 11px;
  }
  @media (hover: hover) {
    .start-day:hover {
      filter: saturate(1.15) brightness(1.04);
    }
  }
</style>
