<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { keyDate, shortDate } from '../lib/time';
  import { hueColor, inkOn } from '../lib/types';

  // Tasks with no duration: ticked off, never timed, kept out of the timeline. Like a task's
  // Start button, ticking waits for the day to start (unticking never does); tapping one before
  // then says so.
  const checks = $derived(P.day.items.filter((i) => i.kind === 'check' && i.status !== 'skipped'));
  const done = $derived(checks.filter((i) => i.status === 'done').length);
</script>

{#if checks.length}
  <section class="checklist" aria-label="Checklist">
    <div class="head">
      <h2>Checklist</h2>
      <span class="count">{done}/{checks.length}</span>
    </div>
    <ul>
      {#each checks as it (it.id)}
        {@const moved = it.status === 'postponed'}
        {@const waiting = P.waiting && it.status === 'todo'}
        <li class:done={it.status === 'done'} class:moved>
          <button
            class="box hit"
            role="checkbox"
            aria-checked={it.status === 'done'}
            aria-label={it.title}
            disabled={moved}
            aria-disabled={waiting}
            style:--c={hueColor(it.hue)}
            style:--ink={inkOn(it.hue)}
            onclick={() => (waiting ? P.askToStartDay('check') : P.toggleCheck(it.id))}
            >{it.status === 'done' ? '✓' : ''}</button
          >
          <button class="title" onclick={() => P.openSheet({ type: 'task', id: it.id })}>{it.title}</button>
          {#if moved && it.movedKey}
            <span class="meta">Moved to {shortDate(keyDate(it.movedKey))}</span>
          {:else if it.repeat !== 'Once'}
            <span class="meta">↻ {it.repeat}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .checklist {
    margin: 14px var(--px) 2px;
    padding: 12px 14px 6px 16px;
    border-radius: 16px;
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: 4px;
  }
  h2 {
    margin: 0;
    font: 400 15px/1.3 var(--font);
  }
  .count {
    font: 400 13px/1 var(--font);
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }
  .box {
    --hit-x: 10px;
    --hit-y: 10px;
    width: 24px;
    height: 24px;
    flex: none;
    border-radius: 99px;
    border: 1.5px solid var(--c);
    background: color-mix(in oklab, var(--c) 14%, transparent);
    color: var(--ink);
    font: 400 13px/1 var(--font);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    transition:
      background 200ms,
      border-color 200ms;
  }
  .done .box {
    background: var(--c);
  }
  .title {
    all: unset;
    flex: 1;
    min-width: 0;
    font: 400 15px/1.3 var(--font);
    color: var(--text);
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  .title:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .done .title,
  .moved .title {
    color: var(--muted);
    text-decoration: line-through;
    text-decoration-color: var(--faint);
  }
  .box:disabled,
  .box[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .moved .box {
    cursor: default;
  }
  .meta {
    font: 400 12px/1.2 var(--font);
    color: var(--muted);
    white-space: nowrap;
  }
</style>
