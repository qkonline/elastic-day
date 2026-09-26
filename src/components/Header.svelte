<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { dayDiff, fNZ, keyDate, monthShort, shortDate, weekdayLong } from '../lib/time';

  const vDate = $derived(keyDate(P.viewKey));
  const diff = $derived(dayDiff(P.today, P.viewKey));
  const dayName = $derived(
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : diff === -1
          ? 'Yesterday'
          : `${vDate.getDate()} ${monthShort(vDate)}`,
  );
  // Today, tomorrow and yesterday show the date; further away, say how far you are from today.
  const small = $derived(
    Math.abs(diff) <= 1
      ? shortDate(vDate)
      : diff > 0
        ? `${weekdayLong(vDate)}, in ${diff} days`
        : `${weekdayLong(vDate)}, ${-diff} days ago`,
  );
  const started = $derived(P.day.dayStarted != null);
</script>

<header class="header">
  <div class="left">
    <div class="small">{small}</div>
    <h1 class="title">{dayName}</h1>
  </div>
  {#if P.isToday && started}
    <span class="started">Day started at {fNZ(P.day.dayStarted!, P.settings.clock24)}</span>
  {:else if !P.isToday}
    <!-- The dot is the timeline's "now" marker: this takes you back to now. -->
    <button class="today" onclick={() => P.backToToday()}><span class="now"></span>Back to today</button>
  {/if}
  <button class="settings" aria-label="Settings" onclick={() => P.openSheet({ type: 'settings' })}>
    <span class="hex"><span class="hex-in"><span class="ring"></span></span></span>
  </button>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    height: calc(var(--header-h) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) var(--px) 0;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 4;
    background: var(--bg);
    box-shadow: 0 1px 0 var(--border);
  }
  .left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .small {
    font: 400 13px/16px var(--font);
    height: 16px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .today {
    height: var(--btn);
    padding: 0 18px 0 16px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 400 15px/1 var(--font);
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    flex: none;
    transition:
      border-color 240ms,
      background 240ms;
  }
  .now {
    width: 8px;
    height: 8px;
    border-radius: 99px;
    background: var(--now);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--now) 22%, transparent);
  }
  @media (hover: hover) {
    .today:hover {
      border-color: var(--line);
      background: var(--sunk);
    }
  }
  .title {
    margin: 0;
    font: 400 26px/1.05 var(--font);
    letter-spacing: -0.02em;
  }
  .started {
    font: 400 13px/1 var(--font);
    color: var(--muted);
    padding: 0 4px;
    white-space: nowrap;
  }
  .settings {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex: none;
  }
  .hex,
  .hex-in {
    display: flex;
    align-items: center;
    justify-content: center;
    clip-path: polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%);
  }
  .hex {
    width: 22px;
    height: 22px;
    background: #818cf8;
  }
  .hex-in {
    width: 17px;
    height: 17px;
    background: var(--bg);
  }
  @media (hover: hover) {
    .settings:hover {
      background: var(--sunk);
    }
    .settings:hover .hex-in {
      background: var(--sunk);
    }
  }
  .ring {
    width: 7px;
    height: 7px;
    border-radius: 99px;
    border: 2px solid #818cf8;
    box-sizing: border-box;
  }
</style>
