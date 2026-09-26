<script lang="ts">
  import { untrack } from 'svelte';
  import { planner as P } from '../lib/planner.svelte';
  import { itemVM, RUN } from '../lib/rows';
  import { dL, hhmm, hm, keyDate, weekdayLong } from '../lib/time';
  import DisarmBar from './DisarmBar.svelte';
  import Fields, { KINDS } from './Fields.svelte';
  import PostponeChooser from './PostponeChooser.svelte';
  import StepBox from './StepBox.svelte';
  let { id: idProp }: { id: string } = $props();
  // The sheet is keyed by task, so the id never changes while it's open. Keep a copy: blur
  // handlers still run while the sheet is being removed, after the sheet state is cleared.
  const id = untrack(() => idProp);

  const row = $derived(P.sch.rows.find((r) => r.it.id === id));
  const v = $derived(
    row
      ? itemVM(row, {
          day: P.day,
          rows: P.sch.rows,
          n: P.n,
          isToday: P.isToday,
          showTimes: true,
          clock24: P.settings.clock24,
          drag: null,
        })
      : null,
  );
  const it = $derived(v?.it);
  const postponeArmed = $derived(P.armed('postpone', id));
  const delArmed = $derived(P.armed('delete', id));

  const repeats = $derived.by(() => {
    const list = ['Once', 'Every day', 'Weekdays', 'Every ' + weekdayLong(keyDate(P.viewKey))];
    if (it && !list.includes(it.repeat)) list.push(it.repeat);
    return list;
  });

  // The task can disappear underneath the sheet (cleared day, another tab): close it then.
  $effect(() => {
    if (!v) P.closeSheet();
  });

  let newSub = $state('');
  const ring = $derived(
    !v ? '' : v.s === 'paused' ? '2px solid var(--muted)' : v.isOver ? '2px solid #f87171' : `2px solid ${RUN}`,
  );
  const barBg = $derived(!v ? '' : v.s === 'paused' ? 'var(--muted)' : v.isOver ? '#f87171' : RUN);

  function addStep() {
    if (!newSub.trim()) return;
    P.addSub(id, newSub);
    newSub = '';
  }
</script>

{#if v && it}
  <div class="head">
    <span class="icon" aria-hidden="true">
      <span
        style:background={it.kind === 'buffer' ? 'transparent' : v.hue}
        style:border={it.kind === 'buffer' ? '1.5px dashed var(--faint)' : 'none'}
      ></span>
    </span>
    <div class="ht">
      <span class="summary">
        {[
          dL(it.min),
          it.repeat !== 'Once' ? it.repeat : null,
          v.fixedAt ? 'fixed ' + v.fixedAt : null,
          it.kind === 'buffer' ? 'Buffer' : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      <input
        class="title"
        value={it.title}
        aria-label="Title"
        oninput={(e) => P.edit(id, { title: e.currentTarget.value })}
        onblur={(e) => !e.currentTarget.value.trim() && P.edit(id, { title: 'Untitled' })}
      />
    </div>
    <button class="close-x" aria-label="Close" onclick={() => P.closeSheet()}>×</button>
  </div>

  <div class="body">
    {#if postponeArmed && !v.active}
      <PostponeChooser {id} title={it.title} large />
    {/if}

    {#if v.active}
      <div class="timer" style:border={ring}>
        <div class="trow">
          <div class="tcol">
            <span class="count" style:color={v.countColor}>{v.count}</span>
            <span class="tsub">
              {v.s === 'paused'
                ? `${v.countSub} · worked ${dL(v.w)} of ${dL(it.min)}`
                : `worked ${dL(v.w)} of ${dL(it.min)}` + (v.pausedTot >= 0.5 ? ` · paused ${dL(v.pausedTot)}` : '')}
            </span>
          </div>
          <span class="badge">{v.s === 'paused' ? '‖ Paused' : v.isOver ? 'Over time' : 'Running'}</span>
        </div>
        <div class="bar"><div style:width="{v.isOver ? 100 : v.p}%" style:background={barBg}></div></div>
        {#if postponeArmed}
          <PostponeChooser {id} title={it.title} worked={v.w} large />
        {:else}
          <div class="ctls">
            <!-- One button that flips, so keyboard focus stays on it. -->
            <button
              class="ctl primary"
              aria-label="{v.s === 'running' ? 'Pause' : 'Resume'} {it.title}"
              onclick={() => (v.s === 'running' ? P.pause(id) : P.resume(id))}
              ><span class="g">{v.s === 'running' ? '‖' : '▶'}</span>{v.s === 'running' ? 'Pause' : 'Resume'}</button
            >
            <button class="ctl done" aria-label="Done {it.title}" onclick={() => P.finish(id)}
              ><span class="g">✓</span>Done</button
            >
            <button class="ctl ghost" aria-label="Postpone {it.title}" onclick={() => P.arm('postpone', id)}
              ><span class="g">↷</span>Postpone</button
            >
          </div>
        {/if}
      </div>
    {/if}

    <div class="card">
      <Fields field="duration" min={it.min} onMin={(m) => m !== it.min && P.edit(id, { min: m })} />
      <div class="group">
        <span class="label">Kind</span>
        <div class="row">
          {#each KINDS as [k, l] (k)}
            <button class="chip" aria-pressed={it.kind === k} onclick={() => P.setKind(id, k)}>{l}</button>
          {/each}
          {#if it.kind === 'fixed'}
            <input
              class="time"
              type="time"
              aria-label="Fixed time"
              value={it.fixedAt != null ? hhmm(it.fixedAt) : ''}
              onchange={(e) => e.currentTarget.value && P.edit(id, { fixedAt: hm(e.currentTarget.value) })}
            />
          {/if}
        </div>
      </div>
      <div class="group">
        <span class="label">Repeats</span>
        <div class="row">
          {#each repeats as r (r)}
            <button class="chip" aria-pressed={it.repeat === r} onclick={() => P.setRepeat(id, r)}>{r}</button>
          {/each}
        </div>
        {#if it.repeat !== 'Once'}
          <span class="hint">Changes here also update later days you have not started yet.</span>
        {/if}
      </div>
      <Fields field="colour" hue={it.hue} onHue={(h) => P.edit(id, { hue: h })} />
      <div class="pos">
        <span class="label">Position · {v.idx + 1} of {P.day.items.length}</span>
        <button class="pb" onclick={() => P.move(id, -1)}>↑ Earlier</button>
        <button class="pb" onclick={() => P.move(id, 1)}>↓ Later</button>
      </div>
    </div>

    <div class="card tight">
      <span class="label sublabel">
        Subtasks {it.subtasks.length ? `· ${it.subtasks.filter((x) => x.d).length}/${it.subtasks.length}` : ''}
      </span>
      {#each it.subtasks as x, xi (x.id)}
        <div class="step">
          <button
            class="tog hit"
            style:--hit-x="4px"
            style:--hit-y="4px"
            role="checkbox"
            aria-checked={x.d}
            aria-label="Toggle step: {x.t}"
            onclick={() => P.toggleSub(id, x.id)}
          >
            <StepBox index={xi} done={x.d} />
          </button>
          <span class="st" class:done={x.d}>{x.t}</span>
          <button class="rm hit" aria-label="Remove step: {x.t}" onclick={() => P.removeSub(id, x.id)}>×</button>
        </div>
      {/each}
      <input
        class="newsub"
        bind:value={newSub}
        onkeydown={(e) => e.key === 'Enter' && !e.isComposing && addStep()}
        onblur={addStep}
        placeholder="Add a step…"
        aria-label="Add a step"
      />
    </div>

    <div class="card tight notes">
      <span class="label">Notes</span>
      <textarea
        rows="3"
        placeholder="Anything to remember"
        aria-label="Notes"
        value={it.note}
        oninput={(e) => P.edit(id, { note: e.currentTarget.value })}></textarea>
    </div>
  </div>

  <div class="foot">
    {#if delArmed}
      <span class="del-q">
        {it.repeat !== 'Once' ? 'Delete from' : 'Delete?'}
        <button class="btn-yes" onclick={() => P.remove(id)} {@attach (el) => el.focus()}
          >{it.repeat !== 'Once' ? 'This day' : 'Delete'}</button
        >
        <button class="btn-no" onclick={() => P.disarm()}>Cancel</button>
        <DisarmBar />
      </span>
    {:else}
      <button class="fb red" onclick={() => P.arm('delete', id)}>Delete</button>
      {#if it.repeat !== 'Once'}
        <button class="fb muted" onclick={() => P.stopRepeating(id)}>Stop repeating</button>
      {/if}
      {#if v.s === 'todo' || v.s === 'skipped'}
        <button class="fb" onclick={() => (v.s === 'skipped' ? P.restore(id) : P.skip(id))}>
          {v.s === 'skipped' ? 'Restore' : 'Skip today'}
        </button>
      {/if}
    {/if}
    {#if P.isToday && v.s === 'todo' && !postponeArmed}
      <button class="fb pp" onclick={() => P.arm('postpone', id)}>Postpone</button>
    {/if}
    {#if v.s === 'done'}
      <button class="fb" onclick={() => P.reopen(id)}>Reopen</button>
    {/if}
    <button class="close" onclick={() => P.closeSheet()}>Done</button>
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
  }
  .icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--raised);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    box-sizing: border-box;
  }
  .icon span {
    width: 14px;
    height: 14px;
    border-radius: 99px;
    box-sizing: border-box;
  }
  .ht {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .summary {
    font: 400 12px/1 var(--font);
    color: var(--muted);
  }
  .title {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    padding: 4px 0;
    font: 400 21px/1.2 var(--font);
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .timer {
    padding: 16px;
    border-radius: 16px;
    background: var(--raised);
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: border-color 240ms;
  }
  .trow {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }
  .tcol {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .count {
    font: 300 56px/1 var(--font);
    letter-spacing: -0.03em;
    transition: color 240ms;
  }
  .tsub {
    font: 400 13px/1.3 var(--font);
    color: var(--muted);
  }
  .badge {
    font: 400 12px/1 var(--font);
    padding: 6px 10px;
    border-radius: 99px;
    background: var(--sunk);
    white-space: nowrap;
  }
  .bar {
    height: 6px;
    border-radius: 9px;
    background: var(--sunk);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    border-radius: 9px;
    transition: background 240ms;
  }
  .ctls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .card {
    padding: 16px;
    border-radius: 16px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .card.tight {
    padding: 14px 16px;
    gap: 6px;
  }
  .card.notes {
    gap: 8px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .time {
    height: 40px;
    padding: 0 8px;
    border-radius: 10px;
    border: none;
    background: var(--sunk);
    color: var(--text);
    font: 400 14px/1 var(--font);
  }
  .hint {
    font: 400 12px/1.4 var(--font);
    color: var(--muted);
  }
  .pos {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pos .label {
    margin-right: auto;
  }
  .pb {
    height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--raised);
    color: var(--text);
    font: 400 13px/1 var(--font);
    cursor: pointer;
  }
  .sublabel {
    padding-bottom: 4px;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 400 15px/1.3 var(--font);
  }
  .tog {
    width: 36px;
    height: 36px;
    margin: 0 -8px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .st {
    flex: 1;
    overflow-wrap: anywhere;
  }
  .st.done {
    color: var(--muted);
  }
  .rm {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--faint);
    font: 400 16px/1 var(--font);
    cursor: pointer;
  }
  .newsub {
    height: 40px;
    border: none;
    outline: none;
    background: transparent;
    padding: 0 0 0 30px;
    font: 400 14px/1 var(--font);
    color: var(--text);
  }
  textarea {
    border: none;
    outline: none;
    resize: vertical;
    background: transparent;
    font: 400 15px/1.45 var(--font);
    color: var(--text);
    padding: 0;
  }
  .foot {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 12px 16px calc(28px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .fb {
    height: 44px;
    padding: 0 10px;
    border: none;
    background: transparent;
    color: var(--text);
    font: 400 14px/1 var(--font);
    cursor: pointer;
  }
  .fb.red {
    color: var(--redT);
  }
  .fb.muted {
    color: var(--muted);
  }
  .fb.pp {
    padding: 0 14px;
    border: 1.5px solid #fb923c;
    border-radius: 12px;
    color: var(--orT);
  }
  .del-q {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 400 14px/1 var(--font);
    position: relative;
    overflow: hidden;
    padding-bottom: 6px;
  }
  .close {
    margin-left: auto;
    height: 44px;
    padding: 0 22px;
    border-radius: 12px;
    border: none;
    background: var(--text);
    color: var(--bg);
    font: 400 15px/1 var(--font);
    cursor: pointer;
  }
</style>
