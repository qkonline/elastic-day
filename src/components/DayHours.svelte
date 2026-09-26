<script lang="ts">
  import { planner as P } from '../lib/planner.svelte';
  import { fNZ, hhmm, hm } from '../lib/time';

  let start = $state(hhmm(P.day.dayStart));
  let wrap = $state(hhmm(P.day.wrap));
  const note = $derived(
    P.isToday && P.day.dayStarted != null
      ? `Today started at ${fNZ(P.day.dayStarted, P.settings.clock24)}. The start time is used when you plan other days.`
      : 'The plan begins here until you tap Start my day. Going past the wrap-up time gets flagged, never blocked.',
  );
</script>

<div class="head">
  <span class="h">Day hours</span>
  <span class="note">{note}</span>
</div>
<div class="fields">
  <label>Day starts <input type="time" data-autofocus bind:value={start} /></label>
  <label>Wrap up by <input type="time" bind:value={wrap} /></label>
</div>
<div class="foot">
  <button class="cancel" onclick={() => P.closeSheet()}>Cancel</button>
  <button class="save" onclick={() => start && wrap && P.saveHours(hm(start), hm(wrap))}>Save</button>
</div>

<style>
  .head {
    padding: 22px 20px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .h {
    font: 400 20px/1.2 var(--font);
  }
  .note {
    font: 400 13px/1.45 var(--font);
    color: var(--muted);
    text-wrap: pretty;
  }
  .fields {
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font: 400 15px/1 var(--font);
  }
  input {
    height: 44px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--sunk);
    color: var(--text);
    font: 400 15px/1 var(--font);
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px 20px;
  }
  .cancel,
  .save {
    height: 44px;
    border-radius: 12px;
    font: 400 15px/1 var(--font);
    cursor: pointer;
  }
  .cancel {
    padding: 0 16px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
  }
  .save {
    padding: 0 20px;
    border: none;
    background: var(--text);
    color: var(--bg);
  }
</style>
