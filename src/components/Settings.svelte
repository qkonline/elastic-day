<script lang="ts">
  import { install } from '../lib/install.svelte';
  import { planner as P } from '../lib/planner.svelte';
  import { hasNotifications, needsInstallForNotifications } from '../lib/platform';
  import { pushConfigured } from '../lib/push';
  import { hhmm, hm, keyDate, shortDate } from '../lib/time';
  import type { ShowTimes, ThemePref } from '../lib/types';
  import DisarmBar from './DisarmBar.svelte';

  let fileEl: HTMLInputElement | null = $state(null);
  const S = $derived(P.settings);
  // The browser's permission can change from its own UI, so re-read it on every clock tick.
  const permission = $derived.by(() => {
    void P.clock;
    return hasNotifications() ? Notification.permission : null;
  });
  const notifyOn = $derived(S.notify && permission === 'granted');
  const notifyText = $derived.by(() => {
    if (needsInstallForNotifications())
      return 'On iPhone and iPad, notifications work once Elastic Day is on your Home Screen.';
    if (!permission) return "This browser can't show notifications; the chime and vibration still work.";
    if (permission === 'denied')
      return "Notifications are blocked for this site. Allow them in your browser's site settings to turn them on here.";
    if (notifyOn)
      return pushConfigured()
        ? "You'll get one when time's up, even with Elastic Day closed or your phone locked."
        : "You'll get one when time's up while Elastic Day is in the background.";
    return "Get a notification when time's up, even when you're not looking at Elastic Day.";
  });

  function toggleNotify() {
    if (notifyOn) P.disableNotifications();
    else void P.enableNotifications();
  }
  const count = $derived(P.day.items.length);

  const THEMES: [ThemePref, string][] = [
    ['match', 'Match device'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ];
  const CLOCKS: [boolean, string][] = [
    [true, '24-hour'],
    [false, '12-hour'],
  ];
  const TIMES: [ShowTimes, string][] = [
    ['started', 'Once the day starts'],
    ['always', 'Always'],
    ['never', 'Never'],
  ];

  function sample() {
    if (count) P.arm('sample', 'day');
    else P.loadSample();
  }
</script>

<div class="head">
  <span class="h">Settings</span>
  <button class="close-x" aria-label="Close" onclick={() => P.closeSheet()}>×</button>
</div>
<div class="body">
  <section class="card">
    <span class="ct">Display</span>
    <div class="setting">
      <span class="ol">Theme</span>
      <div class="row">
        {#each THEMES as [k, l] (k)}
          <button class="chip" aria-pressed={S.themePref === k} onclick={() => P.setSettings({ themePref: k })}
            >{l}</button
          >
        {/each}
      </div>
    </div>
    <div class="setting">
      <span class="ol">Clock</span>
      <div class="row">
        {#each CLOCKS as [k, l] (l)}
          <button class="chip" aria-pressed={S.clock24 === k} onclick={() => P.setSettings({ clock24: k })}>{l}</button>
        {/each}
      </div>
    </div>
    <div class="setting">
      <span class="ol">Show times on the timeline</span>
      <div class="row">
        {#each TIMES as [k, l] (k)}
          <button class="chip" aria-pressed={S.showTimes === k} onclick={() => P.setSettings({ showTimes: k })}
            >{l}</button
          >
        {/each}
      </div>
    </div>
  </section>

  {#if install.method}
    <section class="card g12">
      <span class="ct">Install Elastic Day</span>
      <span class="muted">
        Add it to your {install.method === 'mac'
          ? 'Dock'
          : install.method === 'ios'
            ? 'Home Screen'
            : 'home screen or desktop'}. It gets its own icon and opens in its own window, like any other app.
      </span>
      {#if install.method === 'prompt'}
        <button class="btn-plain self" onclick={() => install.prompt()}>Install</button>
      {:else}
        <button class="btn-plain self" onclick={() => P.openSheet({ type: 'install' })}>Show me how</button>
      {/if}
    </section>
  {/if}

  <section class="card g12">
    <div class="alert">
      <div class="at">
        <span class="ct">Time's-up alert</span>
        <span class="muted">Two soft notes, plus a short vibration on phones.</span>
      </div>
      <button
        class="switch hit"
        style:--hit-x="0px"
        class:on={S.alertOn}
        role="switch"
        aria-checked={S.alertOn}
        aria-label="Time's-up alert"
        onclick={() => P.setSettings({ alertOn: !S.alertOn })}><span></span></button
      >
    </div>
    <div class="alert">
      <div class="at">
        <span class="ct">Notifications</span>
        <span class="muted">{notifyText}</span>
      </div>
      <button
        class="switch hit"
        style:--hit-x="0px"
        class:on={notifyOn}
        role="switch"
        aria-checked={notifyOn}
        aria-label="Notifications"
        disabled={!notifyOn && (permission === null || permission === 'denied')}
        onclick={toggleNotify}><span></span></button
      >
    </div>
    {#if needsInstallForNotifications()}
      <button class="btn-plain self" onclick={() => P.openSheet({ type: 'install' })}>Show me how</button>
    {/if}
  </section>

  <section class="card g12">
    <span class="ct">Defaults for new days</span>
    <div class="defaults">
      <label>
        Day starts
        <input
          type="time"
          value={hhmm(S.defStart)}
          onchange={(e) => e.currentTarget.value && P.setSettings({ defStart: hm(e.currentTarget.value) })}
        />
      </label>
      <label>
        Wrap up by
        <input
          type="time"
          value={hhmm(S.defWrap)}
          onchange={(e) => e.currentTarget.value && P.setSettings({ defWrap: hm(e.currentTarget.value) })}
        />
      </label>
    </div>
  </section>

  <section class="card g12">
    <span class="ct">Your data</span>
    <span class="muted">Everything stays in this browser. Back it up as a file whenever you like.</span>
    <div class="row g8">
      <button class="btn-plain" onclick={() => P.exportData()}>Export</button>
      <button class="btn-plain" onclick={() => fileEl?.click()}>Import</button>
      <button class="btn-plain" onclick={sample}>Load sample day</button>
      <input
        type="file"
        accept=".json,application/json"
        bind:this={fileEl}
        hidden
        onchange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) void P.importFile(f);
          e.currentTarget.value = '';
        }}
      />
    </div>
    {#if P.armed('sample', 'day')}
      <span class="confirm">
        Replace the {count} task{count === 1 ? '' : 's'} on {shortDate(keyDate(P.viewKey))} with a sample day?
        <button class="btn-yes" onclick={() => P.loadSample()} {@attach (el) => el.focus()}>Replace</button>
        <button class="btn-no" onclick={() => P.disarm()}>Cancel</button>
        <DisarmBar />
      </span>
    {/if}
    {#if P.importMsg}
      <span class="msg" class:err={P.importMsg.err}>{P.importMsg.t}</span>
    {/if}
    {#if P.armed('erase', 'all')}
      <span class="confirm">
        Erase every day and setting?
        <button class="btn-yes" onclick={() => P.eraseAll()} {@attach (el) => el.focus()}>Erase</button>
        <button class="btn-no" onclick={() => P.disarm()}>Cancel</button>
        <DisarmBar />
      </span>
    {:else}
      <button class="erase" onclick={() => P.arm('erase', 'all')}>Erase everything</button>
    {/if}
  </section>

  <div class="foot">Elastic Day · v2.4<br />The order is the plan.</div>
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
  }
  .h {
    flex: 1;
    font: 400 21px/1.2 var(--font);
    letter-spacing: -0.01em;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 16px calc(28px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .body > :global(*) {
    flex-shrink: 0;
  }
  .card {
    padding: 16px;
    border-radius: 16px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .card.g12 {
    gap: 12px;
  }
  .ct {
    font: 400 15px/1 var(--font);
  }
  .setting {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ol {
    font: 400 13px/1 var(--font);
    color: var(--muted);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .row.g8 {
    gap: 8px;
  }
  .muted {
    font: 400 13px/1.4 var(--font);
    color: var(--muted);
  }
  .alert {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .at {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .switch {
    width: 52px;
    height: 32px;
    border-radius: 99px;
    border: none;
    background: var(--line);
    position: relative;
    cursor: pointer;
    flex: none;
    padding: 0;
    transition: background 160ms;
  }
  .switch.on {
    background: var(--text);
  }
  .switch span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 26px;
    height: 26px;
    border-radius: 99px;
    background: var(--raised);
    transition: left 160ms;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }
  .switch.on span {
    left: 23px;
  }
  .switch:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .self {
    align-self: flex-start;
  }
  .defaults {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    font: 400 13px/1 var(--font);
    color: var(--muted);
  }
  .defaults label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .defaults input {
    height: 40px;
    padding: 0 8px;
    border-radius: 8px;
    border: none;
    background: var(--sunk);
    color: var(--text);
    font: 400 14px/1 var(--font);
  }
  .msg {
    font: 400 13px/1.4 var(--font);
    color: var(--muted);
  }
  .msg.err {
    color: var(--redT);
  }
  .erase {
    align-self: flex-start;
    height: 40px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--redT);
    font: 400 13px/1 var(--font);
    cursor: pointer;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font: 400 14px/1.3 var(--font);
    position: relative;
    overflow: hidden;
    padding-bottom: 8px;
  }
  .foot {
    text-align: center;
    padding: 8px 0 0;
    font: 400 12px/1.6 var(--font);
    color: var(--faint);
  }
</style>
