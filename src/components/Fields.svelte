<script lang="ts" module>
  export const PICKS = [15, 30, 45, 60, 90, 120];
  export const KINDS: [import('../lib/types').Kind, string][] = [
    ['task', 'Task'],
    ['buffer', 'Buffer'],
    ['fixed', 'Fixed time'],
  ];
</script>

<script lang="ts">
  // Duration picks + custom minutes, and the colour swatches. Shared by the New task modal
  // and the task sheet.
  import { dL } from '../lib/time';
  import { HUES, type Hue } from '../lib/types';

  let {
    field,
    min = 0,
    minText = '',
    onMin,
    onMinText,
    onMinCommit,
    onEnter,
    hue,
    onHue,
    ringBg = 'var(--raised)',
  }: {
    field: 'duration' | 'colour';
    min?: number;
    minText?: string;
    onMin?: (m: number) => void;
    /** Called on every keystroke (a form that saves later). */
    onMinText?: (s: string) => void;
    /** Called once typing is finished: Enter or leaving the field (editing a live task). */
    onMinCommit?: (s: string) => void;
    onEnter?: () => void;
    hue?: Hue;
    onHue?: (h: Hue) => void;
    ringBg?: string;
  } = $props();

  const digits = (v: string) => v.replace(/[^0-9]/g, '');
</script>

{#if field === 'duration'}
  <div class="group">
    <span class="label">How long</span>
    <div class="picks">
      {#each PICKS as m (m)}
        <button class="chip" aria-pressed={min === m} onclick={() => onMin?.(m)}>{dL(m)}</button>
      {/each}
      <span class="custom">
        <input
          value={minText}
          inputmode="numeric"
          aria-label="Minutes"
          oninput={(e) => onMinText?.(digits(e.currentTarget.value))}
          onchange={(e) => onMinCommit?.(digits(e.currentTarget.value))}
          onkeydown={(e) => {
            if (e.key !== 'Enter' || e.isComposing) return;
            onMinCommit?.(digits(e.currentTarget.value));
            onEnter?.();
          }}
        />
        <span>min</span>
      </span>
    </div>
  </div>
{:else}
  <div class="colour">
    <span class="label">Colour</span>
    {#each Object.entries(HUES) as [k, col] (k)}
      <button class="sw" aria-label={k} aria-pressed={hue === k} onclick={() => onHue?.(k as Hue)}>
        <span
          style:background={col}
          style:box-shadow={hue === k ? `0 0 0 2px ${ringBg}, 0 0 0 4px var(--text)` : 'none'}
        ></span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 10px;
    border-radius: 10px;
    background: var(--sunk);
  }
  .custom input {
    width: 38px;
    border: none;
    outline: none;
    background: transparent;
    text-align: right;
    font: 400 14px/1 var(--font);
    color: var(--text);
    padding: 0;
  }
  .custom span {
    font: 400 13px/1 var(--font);
    color: var(--muted);
  }
  .colour {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
  }
  .colour .label {
    margin-right: auto;
  }
  .sw {
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .sw span {
    width: 28px;
    height: 28px;
    border-radius: 99px;
  }
</style>
