// Reorder by dragging a capsule. Touch: long-press (~380 ms, 15 ms vibration). Mouse: drag
// starts after 4px of movement. A plain tap opens the task sheet, from the capsule's click
// event (see `tapped`): opening it on pointerup would let the same tap's click land on
// whatever the new sheet puts under the finger.

import { vibrate } from './alert';
import type { Planner } from './planner.svelte';

/** When the last drag ended, so the click that follows it isn't taken as a tap. */
let dragEndedAt = 0;

/** Capsule click: open the task sheet unless this click is the tail end of a drag. */
export function tapped(p: Planner, id: string): void {
  if (Date.now() - dragEndedAt < 500) return;
  p.openSheet({ type: 'task', id });
}

export function capsuleDown(p: Planner, e: PointerEvent, id: string, list: () => HTMLElement | null): void {
  if (e.button && e.button !== 0) return;
  const touchy = e.pointerType !== 'mouse';
  const x0 = e.clientX,
    y0 = e.clientY;
  let started = false;

  const begin = () => {
    started = true;
    p.drag = { id, over: null };
    vibrate(15);
  };
  const timer = setTimeout(
    () => {
      if (!started) begin();
    },
    touchy ? 380 : 99999,
  );

  const cleanup = () => {
    clearTimeout(timer);
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', cancel);
  };
  const move = (ev: PointerEvent) => {
    const d = Math.hypot(ev.clientX - x0, ev.clientY - y0);
    if (!started) {
      if (!touchy && d > 4) begin();
      else {
        if (touchy && d > 10) cleanup();
        return;
      }
    }
    ev.preventDefault();
    dragOver(p, ev.clientY, list());
  };
  const up = () => {
    cleanup();
    if (!started) return;
    dragEndedAt = Date.now();
    p.commitDrag();
  };
  const cancel = () => {
    cleanup();
    if (!started) return;
    dragEndedAt = Date.now();
    p.drag = null;
  };
  addEventListener('pointermove', move, { passive: false });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', cancel);
}

function dragOver(p: Planner, y: number, root: HTMLElement | null): void {
  if (!root) return;
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 62;
  if (y < top + 60) scrollBy(0, -12);
  if (y > innerHeight - 60) scrollBy(0, 12);
  let over = p.day.items.length;
  for (const el of root.querySelectorAll<HTMLElement>('[data-drag-idx]')) {
    const r = el.getBoundingClientRect();
    if (y < r.top + r.height / 2) {
      over = Number(el.dataset.dragIdx);
      break;
    }
  }
  p.dragOver(over);
}
