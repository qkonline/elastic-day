// Keeps bottom sheets above the on-screen keyboard. iOS doesn't shrink the page when the
// keyboard opens, so anything fixed to the bottom of the screen ends up behind it. The visual
// viewport says how much of the screen is still visible; expose that to CSS as
//   --kb   how far the keyboard reaches up from the bottom of the page (0 when closed)
//   --vvh  the height of what's still visible
// Android Chrome resizes the page itself (see interactive-widget in index.html), so --kb stays 0.

export function trackKeyboard(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const update = () => {
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty('--kb', `${Math.round(covered)}px`);
    root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}
