<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { dayDiff, fNZ, keyDate, monthShort, shortDate, weekdayShort } from '../lib/time';

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
  const small = $derived(Math.abs(diff) <= 1 ? shortDate(vDate) : weekdayShort(vDate));
  const started = $derived(P.day.dayStarted != null);
  const showStart = $derived(
    P.isToday && !started && P.day.items.some((i) => i.status === 'todo' && i.kind !== 'buffer'),
  );
</script>

<header class="header">
  <div class="left">
    <div class="small">
      {small}
      {#if !P.isToday}<button class="back hit" style:--hit-y="14px" onclick={() => P.backToToday()}
          >Back to today</button
        >{/if}
    </div>
    <h1 class="title">{dayName}</h1>
  </div>
  {#if showStart}
    <button class="startday" onclick={() => P.startDay()}><span>▶</span>Start my day</button>
  {:else if P.isToday && started}
    <span class="started">Day started at {fNZ(P.day.dayStarted!, P.settings.clock24)}</span>
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
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .back {
    border: none;
    background: transparent;
    padding: 0;
    height: 16px;
    color: var(--grT);
    font: 400 13px/16px var(--font);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .title {
    margin: 0;
    font: 400 26px/1.05 var(--font);
    letter-spacing: -0.02em;
  }
  .startday {
    height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    background: var(--text);
    color: var(--bg);
    font: 400 15px/1 var(--font);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  .startday span {
    font-size: 11px;
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
    background: color-mix(in oklab, #818cf8 10%, var(--raised));
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
    background: color-mix(in oklab, #818cf8 10%, var(--raised));
  }
  .ring {
    width: 7px;
    height: 7px;
    border-radius: 99px;
    border: 2px solid #818cf8;
    box-sizing: border-box;
  }
</style>
