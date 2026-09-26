<script lang="ts">
  import { onMount } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import AddTask from './components/AddTask.svelte';
  import DayFooter from './components/DayFooter.svelte';
  import DayHours from './components/DayHours.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Header from './components/Header.svelte';
  import InstallGuide from './components/InstallGuide.svelte';
  import NotifyPrompt from './components/NotifyPrompt.svelte';
  import RunningElsewhere from './components/RunningElsewhere.svelte';
  import Settings from './components/Settings.svelte';
  import Sheet from './components/Sheet.svelte';
  import TaskSheet from './components/TaskSheet.svelte';
  import Timeline from './components/Timeline.svelte';
  import WeekStrip from './components/WeekStrip.svelte';
  import { planner as P } from './lib/planner.svelte';

  const prefersDark = new MediaQuery('(prefers-color-scheme: dark)', false);
  const theme = $derived(
    P.settings.themePref === 'match' ? (prefersDark.current ? 'dark' : 'light') : P.settings.themePref,
  );

  onMount(() => {
    void P.init().then(() => {
      // The installed app's "Add task" shortcut opens with ?add.
      const url = new URL(location.href);
      if (P.ready && url.searchParams.has('add')) {
        P.openSheet({ type: 'add' });
        url.searchParams.delete('add');
        history.replaceState(null, '', url);
      }
    });
    return () => P.destroy();
  });

  $effect(() => {
    const root = document.documentElement;
    if (P.settings.themePref === 'match') delete root.dataset.theme;
    else root.dataset.theme = P.settings.themePref;
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
      m.setAttribute('content', theme === 'dark' ? '#0e1014' : '#f6f7f9');
      m.removeAttribute('media');
    }
  });

  $effect(() => {
    document.body.classList.toggle('locked', !!P.sheet);
  });

  const LABELS = {
    task: 'Edit task',
    hours: 'Day hours',
    add: 'New task',
    settings: 'Settings',
    install: 'Install',
  } as const;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && P.sheet && P.closeSheet()} />

{#if P.failed}
  <div class="failed">
    <h1>Elastic Day can't start here</h1>
    <p>
      This browser won't let the planner store anything (private browsing or blocked site data can do this), so there is
      nowhere to keep your plan. Try a normal window, or allow site data for this page.
    </p>
    <p class="detail">{P.failed}</p>
  </div>
{:else if P.ready}
  <!-- inert: while a sheet is open, keyboard and screen readers stay inside it. -->
  <div class="page" inert={!!P.sheet}>
    <Header />
    <WeekStrip />
    <RunningElsewhere />
    <NotifyPrompt />
    <main>
      {#if P.day.items.length === 0}
        <EmptyState />
      {:else}
        <Timeline />
      {/if}
      <DayFooter />
    </main>
  </div>

  <button class="fab" aria-label="Add task" inert={!!P.sheet} onclick={() => P.openSheet({ type: 'add' })}>
    <span class="plus">+</span><span>Add task</span>
  </button>

  {#if P.sheet}
    {#key P.sheet.type === 'task' ? 'task-' + P.sheet.id : P.sheet.type}
      <Sheet
        variant={P.sheet.type === 'add'
          ? 'form'
          : P.sheet.type === 'hours' || P.sheet.type === 'install'
            ? 'small'
            : 'full'}
        label={LABELS[P.sheet.type]}
      >
        {#if P.sheet.type === 'task'}
          <TaskSheet id={P.sheet.id} />
        {:else if P.sheet.type === 'add'}
          <AddTask />
        {:else if P.sheet.type === 'hours'}
          <DayHours />
        {:else if P.sheet.type === 'install'}
          <InstallGuide />
        {:else}
          <Settings />
        {/if}
      </Sheet>
    {/key}
  {/if}
{/if}

<div class="sr-only" aria-live="polite">{P.announce}</div>

<style>
  .page {
    display: block;
    max-width: none;
    margin: 0 auto;
    padding: 0 0 calc(96px + env(safe-area-inset-bottom));
    box-sizing: border-box;
  }
  @media (min-width: 768px) {
    .page {
      max-width: 780px;
    }
  }
  .fab {
    position: fixed;
    right: 20px;
    bottom: calc(40px + env(safe-area-inset-bottom));
    z-index: 5;
    height: 52px;
    padding: 0 22px 0 18px;
    border-radius: 999px;
    border: 2.5px solid transparent;
    background:
      linear-gradient(#334155, #334155) padding-box,
      conic-gradient(from 200deg, #fb923c, #fde047, #a3e635, #22d3ee, #818cf8, #fb923c) border-box;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 8px;
    font: 400 15px/1 var(--font);
    box-shadow:
      0 10px 28px -8px rgba(15, 23, 42, 0.45),
      0 2px 6px rgba(15, 23, 42, 0.18);
    cursor: pointer;
  }
  @media (min-width: 768px) {
    .fab {
      right: max(28px, calc((100% - 780px) / 2));
      bottom: 28px;
    }
  }
  .plus {
    font: 300 26px/1 var(--font);
    margin-top: -3px;
  }
  .failed {
    max-width: 480px;
    margin: 15vh auto 0;
    padding: 0 24px;
  }
  .failed h1 {
    font: 400 22px/1.3 var(--font);
    letter-spacing: -0.01em;
  }
  .failed p {
    font: 400 15px/1.5 var(--font);
    color: var(--muted);
  }
  .failed .detail {
    font-size: 13px;
    color: var(--faint);
  }
</style>
