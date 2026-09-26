<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { planner as P } from '../lib/planner.svelte';
  import { desktop, reducedMotion } from '../lib/ui.svelte';

  /**
   * full: bottom sheet (88%) on phone, 440px right side panel on desktop.
   * form: bottom sheet sized to content on phone, centred 480px dialog on desktop.
   * small: centred 360px dialog everywhere.
   */
  let { variant, label, children }: { variant: 'full' | 'form' | 'small'; label: string; children: Snippet } = $props();

  let panel: HTMLDivElement | null = $state(null);
  const shape = $derived(
    variant === 'small'
      ? 'dialog small'
      : desktop.current
        ? variant === 'form'
          ? 'dialog'
          : 'side'
        : variant === 'form'
          ? 'bottom'
          : 'bottom tall',
  );

  // Move focus into the sheet when it opens and hand it back to whatever opened it on close.
  onMount(() => {
    const prev = document.activeElement as HTMLElement | null;
    const auto = panel?.querySelector<HTMLElement>('[data-autofocus]');
    (auto ?? panel)?.focus({ preventScroll: true });
    return () => {
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  });

  // Keep Tab inside the sheet.
  function trap(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !panel) return;
    const f = [
      ...panel.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])'),
    ].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div
  class="scrim"
  onclick={() => P.closeSheet()}
  aria-hidden="true"
  in:fade|global={{ duration: reducedMotion.current ? 0 : 200 }}
></div>
<div
  class="panel {shape}"
  role="dialog"
  aria-modal="true"
  aria-label={label}
  tabindex="-1"
  bind:this={panel}
  onkeydown={trap}
  in:fade|global={{ duration: reducedMotion.current ? 0 : 200 }}
>
  {#if !desktop.current && variant !== 'small'}
    <div class="handle"><span></span></div>
  {/if}
  {@render children()}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 6;
  }
  .panel {
    position: fixed;
    z-index: 7;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    outline: none;
  }
  /* Sit on top of the on-screen keyboard and never be taller than what's still visible. */
  .bottom {
    left: 0;
    right: 0;
    bottom: var(--kb, 0px);
    max-height: min(88dvh, calc(var(--vvh, 100dvh) - 12px));
    border-radius: 22px 22px 0 0;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
  }
  .bottom.tall {
    height: min(88dvh, calc(var(--vvh, 100dvh) - 12px));
  }
  .dialog {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(480px, calc(100% - 32px));
    max-height: calc(100dvh - 64px);
    border-radius: 20px;
    border: 1px solid var(--border);
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.35);
  }
  .dialog.small {
    width: min(360px, calc(100% - 32px));
  }
  .side {
    top: 0;
    right: 0;
    bottom: 0;
    width: 440px;
    border-left: 1px solid var(--border);
    box-shadow: -16px 0 48px rgba(0, 0, 0, 0.16);
  }
  .handle {
    display: flex;
    justify-content: center;
    padding: 8px 0 0;
    flex: none;
  }
  .handle span {
    width: 40px;
    height: 5px;
    border-radius: 9px;
    background: var(--line);
  }
</style>
