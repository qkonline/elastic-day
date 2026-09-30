<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { planner as P } from '../lib/planner.svelte';
  import { reducedMotion } from '../lib/ui.svelte';

  // After tapping a check or a Start button before the day has started: start the day first,
  // with the button to do it right here. It sits just above Add task and goes by itself.
  const n = $derived(P.nudge);
</script>

{#if n}
  <div class="nudge" transition:fly={{ y: 14, duration: reducedMotion.current ? 0 : 220, easing: cubicOut }}>
    <p>{n.text}</p>
    {#if n.canStart}
      <button class="go" onclick={() => P.startDay()}><span aria-hidden="true">▶</span>Start my day</button>
    {/if}
  </div>
{/if}

<style>
  .nudge {
    position: fixed;
    z-index: 6;
    left: 16px;
    right: 16px;
    bottom: calc(40px + 52px + 14px + env(safe-area-inset-bottom));
    max-width: 460px;
    margin: 0 auto;
    padding: 10px 10px 10px 18px;
    border-radius: 18px;
    background: #334155;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow:
      0 12px 30px -10px rgba(15, 23, 42, 0.5),
      0 2px 6px rgba(15, 23, 42, 0.18);
  }
  @media (min-width: 768px) {
    .nudge {
      bottom: calc(28px + 52px + 14px);
    }
  }
  p {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 4px 0;
    font: 400 14px/1.4 var(--font);
    text-wrap: pretty;
  }
  /* The same pill as the Start my day button at the top of the day. */
  .go {
    flex: none;
    height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: linear-gradient(90deg, #fb923c, #fde047, #a3e635, #22d3ee, #818cf8);
    color: #16181d;
    font: 400 14px/1 var(--font);
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    white-space: nowrap;
  }
  .go span {
    font-size: 10px;
  }
</style>
