<script lang="ts">
  import { CONFIRM_MS, planner } from '../lib/planner.svelte';

  // Shrinks over the 10 s an armed confirm stays open.
  const pct = $derived(
    planner.confirm ? Math.max(0, 100 - ((planner.clock - planner.confirm.at) / CONFIRM_MS) * 100) : 0,
  );
</script>

<span class="bar" style:width="{pct}%" aria-hidden="true"></span>

<style>
  .bar {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--muted);
    transition: width 250ms linear;
  }
</style>
