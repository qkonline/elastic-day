// Browser and device checks for notifications and installing the app.

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

/** iPhone or iPad (iPadOS reports itself as a Mac with a touch screen). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Safari on a Mac, which installs web apps from File → Add to Dock. */
export function isMacSafari(): boolean {
  return (
    !isIOS() && /Macintosh/.test(ua()) && /Safari\//.test(ua()) && !/Chrome|Chromium|Edg\/|OPR\/|Firefox/.test(ua())
  );
}

/** Running as an installed app (home screen, dock, app drawer) rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const hasNotifications = () => typeof window !== 'undefined' && 'Notification' in window;

/** iPhone and iPad only allow web notifications for apps added to the Home Screen. */
export const needsInstallForNotifications = () => isIOS() && !isStandalone() && !hasNotifications();
