<script lang="ts">
  import { justDragged, pickUp, tapped } from '../lib/drag';
  import { planner as P } from '../lib/planner.svelte';
  import type { ItemVM } from '../lib/rows';
  import { dL } from '../lib/time';
  import { desktop } from '../lib/ui.svelte';
  import NowLine from './NowLine.svelte';
  import PostponeChooser from './PostponeChooser.svelte';
  import Reschedule from './Reschedule.svelte';
  import StepBox from './StepBox.svelte';

  let { v, list, shift = 0 }: { v: ItemVM; list: () => HTMLElement | null; shift?: number } = $props();

  const id = $derived(v.id);
  const it = $derived(v.it);
  const lifted = $derived(!!P.drag && P.drag.id === id);
  // Tasks can only be started once "Start my day" has been pressed.
  const dayStarted = $derived(P.day.dayStarted != null);
  const hovered = $derived(desktop.current && P.hover === id);
  const postponeArmed = $derived(P.armed('postpone', id));
  const rsOpen = $derived(!!P.resched && P.resched.id === id && v.missed);
  const showSkip = $derived(P.isToday && hovered && v.s === 'todo' && !v.missed);

  type Ctl = { g: string; l: string; k?: 'primary' | 'done' | 'ghost'; on: () => void };
  const controls: Ctl[] | null = $derived.by(() => {
    if (postponeArmed) return null;
    if (v.missed)
      return rsOpen
        ? null
        : [
            { g: '↻', l: 'Reschedule', k: 'primary', on: () => P.openResched(id) },
            { g: '✓', l: 'Mark done', k: 'done', on: () => P.markDone(id, v.start, v.end) },
          ];
    if (v.s === 'running')
      return [
        { g: '‖', l: 'Pause', on: () => P.pause(id) },
        { g: '✓', l: 'Done', k: 'done', on: () => P.finish(id) },
        { g: '↷', l: 'Postpone', k: 'ghost', on: () => P.arm('postpone', id) },
      ];
    if (v.s === 'paused')
      return [
        { g: '▶', l: 'Resume', k: 'primary', on: () => P.resume(id) },
        { g: '✓', l: 'Done', k: 'done', on: () => P.finish(id) },
        { g: '↷', l: 'Postpone', k: 'ghost', on: () => P.arm('postpone', id) },
      ];
    return null;
  });

  const boxBg = $derived(
    v.s === 'paused'
      ? 'color-mix(in oklab, var(--muted) 9%, transparent)'
      : v.isOver
        ? 'rgba(248,113,113,.08)'
        : 'rgba(250,204,21,.12)',
  );
  const boxRing = $derived(
    v.s === 'paused'
      ? 'color-mix(in oklab, var(--muted) 45%, transparent)'
      : v.isOver
        ? 'rgba(248,113,113,.55)'
        : 'rgba(234,179,8,.6)',
  );

  // Press and hold anywhere on the task's text to pick it up (touch). A pointer-only shortcut:
  // keyboard and screen-reader users move tasks with Earlier / Later in the task sheet.
  function holdToDrag(el: HTMLElement) {
    const down = (e: PointerEvent) => pickUp(P, e, id, list, 'row');
    el.addEventListener('pointerdown', down);
    return () => el.removeEventListener('pointerdown', down);
  }

  // Not when this tap is the end of a press-and-hold drag.
  const open = () => !justDragged() && P.openSheet({ type: 'task', id });
  const capKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };
</script>

<li
  data-drag-idx={v.idx}
  class="row"
  class:active={v.active}
  class:hovered={hovered && !v.active}
  class:lifted
  style:opacity={lifted ? 1 : v.op}
  style:transform={lifted ? `translateY(${P.drag!.dy}px) scale(1.02)` : shift ? `translateY(${shift}px)` : undefined}
  style:min-height="{v.h + 8}px"
  style:--box-bg={boxBg}
  style:--box-ring={boxRing}
  onmouseenter={() => desktop.current && P.hover !== id && (P.hover = id)}
  onmouseleave={() => P.hover === id && (P.hover = null)}
>
  <div class="times" {@attach holdToDrag}>
    {#if v.t1}<span class="t1">{v.t1}</span>{/if}
    {#if v.ap1}<span class="ap">{v.ap1}</span>{/if}
    {#if v.t2}<span class="t2">{v.t2}</span>{/if}
    {#if v.ap2}<span class="ap faint">{v.ap2}</span>{/if}
  </div>

  <div class="spine">
    <span class="line"></span>
    <span
      role="button"
      tabindex="0"
      data-no-swipe
      aria-label="{it.title}. Tap to edit, hold to reorder"
      class="cap"
      class:buffer={it.kind === 'buffer'}
      style:height="{v.h}px"
      style:background={v.capBg}
      style:border={v.capBorder}
      onpointerdown={(e) => pickUp(P, e, id, list, 'capsule')}
      onclick={() => tapped(P, id)}
      onkeydown={capKey}
      oncontextmenu={(e) => e.preventDefault()}
    >
      {#if v.s === 'paused'}
        <span class="pglyph">‖</span>
      {:else}
        <span class="dot" style:background={v.hue}></span>
      {/if}
    </span>
  </div>

  <div class="content" {@attach holdToDrag}>
    <div class="meta">
      <button class="dur hit" style:--hit-x="4px" style:--hit-y="12px" onclick={open}>{dL(it.min)}</button>
      {#if v.sub}<span style:color={v.subTone}>{v.sub}</span>{/if}
      {#if v.fixedAt}<span class="fixed">fixed · {v.fixedAt}</span>{/if}
      {#if showSkip}
        <button class="hover-btn skip" onclick={() => P.skip(id)}>Skip</button>
        <button class="hover-btn pp" onclick={() => P.arm('postpone', id)}>Postpone</button>
      {/if}
    </div>
    <button class="title" class:muted={v.mutedT} class:struck={v.s === 'skipped'} onclick={open}>{it.title}</button>
    {#if v.badges.length || v.flags.length}
      <div class="badges">
        {#each v.badges as b (b)}<span class="badge">{b}</span>{/each}
        {#each v.flags as f (f.t)}<span class="flag {f.tone}">{f.t}</span>{/each}
      </div>
    {/if}
  </div>

  <div class="acts">
    {#if v.aStart}
      <button
        class="start"
        style:border-color={v.hue}
        aria-label="Start {it.title}"
        disabled={!dayStarted}
        title={dayStarted ? undefined : 'Start your day first'}
        onclick={(e) => {
          e.stopPropagation();
          P.startItem(id);
        }}>Start</button
      >
    {/if}
    {#if v.active}
      <span class="count" style:color={v.countColor}>{v.count}</span>
      {#if v.countSub}<span class="count-sub">{v.countSub}</span>{/if}
    {/if}
    {#if v.aCheck}
      <button class="check hit" aria-label="Reopen {it.title}" onclick={() => P.reopen(id)}>✓</button>
    {/if}
    {#if v.aRestore}
      <button class="restore hit" style:--hit-y="4px" onclick={() => P.restore(id)}>{v.restoreLabel}</button>
    {/if}
    {#if v.glyph}<span class="glyph" aria-label="Planned">{v.glyph}</span>{/if}
  </div>

  {#if v.active && it.subtasks.length}
    <div class="wide subs">
      {#each it.subtasks as x, xi (x.id)}
        <button class="sub" onclick={() => P.toggleSub(id, x.id)} role="checkbox" aria-checked={x.d}>
          <StepBox index={xi} done={x.d} />
          <span class="subt" class:done={x.d}>{x.t}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if controls}
    <div class="wide ctls">
      {#each controls as c, i (i)}
        <button class="ctl {c.k ?? ''}" aria-label="{c.l} {it.title}" onclick={c.on}
          ><span class="g">{c.g}</span>{c.l}</button
        >
      {/each}
    </div>
  {/if}

  {#if postponeArmed}
    <div class="wide confirm"><PostponeChooser {id} title={it.title} worked={v.active ? v.w : 0} /></div>
  {/if}

  {#if rsOpen}
    <div class="wide confirm"><Reschedule {v} /></div>
  {/if}

  {#if v.nowIn != null}
    <div
      class="now-in"
      aria-hidden="true"
      style:left={v.active ? '16px' : '0'}
      style:right={v.active ? '16px' : '0'}
      style:top="{(v.active ? 6 : 0) + 4 + v.nowIn * v.h}px"
    >
      <NowLine />
    </div>
  {/if}
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: var(--tc) var(--sc) minmax(0, 1fr) var(--ac);
    align-content: start;
    border-radius: 12px;
    position: relative;
    transition:
      opacity 200ms,
      background 240ms,
      box-shadow 240ms;
  }
  /* Picked up: floats above the list and follows the finger. */
  .row.lifted {
    z-index: 5;
    background: var(--raised);
    box-shadow: 0 14px 32px -10px rgba(0, 0, 0, 0.35);
    border-radius: 16px;
    transition: box-shadow 150ms;
  }
  /* Long-press on a task picks it up, so don't let the phone select its text or pop a menu. */
  .times,
  .content {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .row.hovered {
    background: var(--sunk);
  }
  .row.active {
    background: var(--box-bg);
    box-shadow: inset 0 0 0 1.5px var(--box-ring);
    border-radius: 16px;
    margin: 8px -12px;
    padding: 6px 16px 2px;
  }

  .times {
    grid-row: 1 / span 4;
    padding: 13px 10px 0 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }
  .t1 {
    font: 400 13px/1 var(--font);
  }
  .t2 {
    font: 400 12px/1 var(--font);
    color: var(--faint);
    margin-top: 5px;
  }
  .ap {
    font: 400 10px/1 var(--font);
    color: var(--muted);
    letter-spacing: 0.04em;
  }
  .ap.faint {
    color: var(--faint);
  }

  .spine {
    grid-row: 1 / span 4;
    position: relative;
    display: flex;
    justify-content: center;
    padding: 4px 0;
  }
  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    margin-left: -1px;
    background: var(--line);
  }
  .cap {
    width: var(--cw);
    border-radius: 999px;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 15px;
    position: relative;
    z-index: 1;
    flex: none;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    transition:
      border-color 240ms ease,
      background 240ms ease;
  }
  .cap.buffer {
    width: calc(var(--cw) - 16px);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 99px;
    pointer-events: none;
  }
  .pglyph {
    font: 400 13px/1 var(--font);
    color: var(--muted);
    margin-top: -2px;
    pointer-events: none;
  }

  .content {
    padding: 9px 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font: 400 13px/1.2 var(--font);
    color: var(--muted);
  }
  .dur {
    all: unset;
    position: relative;
    cursor: pointer;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
    text-decoration-color: var(--faint);
  }
  .fixed {
    font: 400 11px/1 var(--font);
    padding: 4px 8px;
    border-radius: 99px;
    background: var(--sunk);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .hover-btn {
    font: 400 13px/1 var(--font);
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--raised);
    cursor: pointer;
  }
  .hover-btn.skip {
    margin-left: auto;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .hover-btn.pp {
    color: var(--orT);
    border: 1.5px solid #fb923c;
  }
  .title {
    all: unset;
    font: 400 16px/1.3 var(--font);
    color: var(--text);
    text-wrap: pretty;
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  .title.muted {
    color: var(--muted);
  }
  .title.struck {
    text-decoration: line-through;
  }
  .title:focus-visible,
  .dur:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
  }
  .badge {
    font: 400 12px/1.2 var(--font);
    color: var(--muted);
  }
  .flag {
    font: 400 12px/1 var(--font);
    padding: 5px 9px;
    border-radius: 99px;
    white-space: nowrap;
    background: rgba(253, 224, 71, 0.3);
    color: var(--yelT);
  }
  .flag.r {
    background: rgba(248, 113, 113, 0.16);
    color: var(--redT);
  }

  .acts {
    padding-top: 9px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
  }
  .start {
    height: var(--btn);
    min-width: 60px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1.5px solid;
    background: var(--raised);
    color: var(--text);
    font: 400 14px/1 var(--font);
    cursor: pointer;
  }
  .start:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .count {
    font: 400 21px/1 var(--font);
    letter-spacing: -0.01em;
    padding-top: 3px;
    transition: color 240ms;
  }
  .count-sub {
    font: 400 11px/1.2 var(--font);
    color: var(--muted);
    text-align: right;
  }
  .check {
    width: 32px;
    height: 32px;
    margin: 2px 4px 0 0;
    border-radius: 99px;
    border: none;
    background: #a3e635;
    color: #1a2e05;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 400 15px/1 var(--font);
    cursor: pointer;
  }
  .restore {
    height: 36px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 400 13px/1 var(--font);
    cursor: pointer;
  }
  .glyph {
    width: 32px;
    height: 32px;
    margin: 2px 4px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--faint);
    font: 400 16px/1 var(--font);
  }

  .wide {
    grid-column: 3 / span 2;
  }
  .subs {
    padding: 0 0 10px 12px;
    display: flex;
    flex-direction: column;
  }
  .sub {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    border: none;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: var(--text);
    font: 400 14px/1.3 var(--font);
  }
  .subt.done {
    color: var(--muted);
    text-decoration: line-through;
    text-decoration-color: var(--faint);
  }
  .ctls {
    padding: 0 0 14px 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .confirm {
    margin: 0 0 14px 12px;
  }
  .now-in {
    position: absolute;
    height: 20px;
    margin-top: -10px;
    display: grid;
    grid-template-columns: var(--tc) minmax(0, 1fr);
    align-items: center;
    pointer-events: none;
    z-index: 3;
  }
</style>
