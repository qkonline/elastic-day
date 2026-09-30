<script lang="ts">
  import { untrack } from 'svelte';
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

  // Tapping a check or a Start button too early (P.nudge) calls this button out: it comes into
  // view if it was scrolled away, jumps and shakes, and keeps a ring and a glow while the
  // "start your day first" message is up. With reduced motion, just the ring and the glow.
  let btn = $state<HTMLButtonElement>();
  const called = $derived(!!P.nudge);
  const JUMP: Keyframe[] = [
    { transform: 'none', easing: 'cubic-bezier(.2,.7,.3,1)' },
    { transform: 'translateY(-14px) scale(1.04)', offset: 0.16, easing: 'cubic-bezier(.5,0,.8,.4)' },
    { transform: 'none', offset: 0.32, easing: 'cubic-bezier(.2,.7,.3,1)' },
    { transform: 'translateY(-6px)', offset: 0.42, easing: 'cubic-bezier(.5,0,.8,.4)' },
    { transform: 'none', offset: 0.52 },
    { transform: 'translateX(-7px) rotate(-2.5deg)', offset: 0.6 },
    { transform: 'translateX(7px) rotate(2.5deg)', offset: 0.68 },
    { transform: 'translateX(-5px) rotate(-1.5deg)', offset: 0.76 },
    { transform: 'translateX(5px) rotate(1.5deg)', offset: 0.84 },
    { transform: 'translateX(-2px)', offset: 0.92 },
    { transform: 'none' },
  ];
  $effect(() => {
    if (!P.nudge?.at || !btn) return;
    untrack(() => callOut(btn!));
  });
  function callOut(el: HTMLElement) {
    const still = reducedMotion.current;
    const r = el.getBoundingClientRect();
    const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const away = r.top < top || r.bottom > innerHeight;
    if (away) el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    if (still) return;
    // After a scroll, jump once it has arrived.
    setTimeout(() => el.animate(JUMP, { duration: 1000 }), away ? 450 : 0);
  }
</script>

{#if show}
  <div class="start-row" transition:slide={fold()}>
    <button class="start-day" class:called bind:this={btn} onclick={() => P.startDay()}
      ><span>▶</span>Start my day</button
    >
  </div>
{/if}

<style>
  .start-row {
    /* Keeps the glow behind the button, not behind the page. */
    isolation: isolate;
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
    position: relative;
    box-shadow: 0 8px 22px -10px rgba(15, 23, 42, 0.45);
    transition:
      filter 200ms,
      box-shadow 240ms ease;
  }
  /* Called out: a ring in the ink colour, set off by a gap, and the day's colours glowing behind. */
  .start-day.called {
    box-shadow:
      0 0 0 3px var(--bg),
      0 0 0 5.5px var(--text),
      0 10px 26px -10px rgba(15, 23, 42, 0.5);
  }
  .start-day::before {
    content: '';
    position: absolute;
    inset: -12px;
    z-index: -1;
    border-radius: inherit;
    background: linear-gradient(90deg, #fb923c, #fde047, #a3e635, #22d3ee, #818cf8);
    filter: blur(16px);
    opacity: 0;
    transition: opacity 300ms ease;
    pointer-events: none;
  }
  .start-day.called::before {
    opacity: 0.7;
    animation: glow 1.4s ease-in-out infinite alternate;
  }
  @keyframes glow {
    from {
      opacity: 0.35;
    }
    to {
      opacity: 0.8;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .start-day.called::before {
      animation: none;
    }
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
