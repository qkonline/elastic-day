// Time's-up notifications while the app is closed or the phone is locked. When the app goes
// into the background with a timer running, it asks the push worker (worker/) to send an
// empty push at the moment time runs out; the service worker then shows the notification,
// reading the task's name from IndexedDB. Only the push address and a time leave the device.

const URL_ = import.meta.env.VITE_PUSH_URL?.replace(/\/$/, '');
const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

let endpoint: string | null = null;

export function pushConfigured(): boolean {
  return !!URL_ && !!KEY && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Make sure there is a push subscription and remember its address, so that going into the
 * background can send the request straight away (pages get frozen soon after).
 */
export async function preparePush(): Promise<boolean> {
  if (!pushConfigured() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }));
    endpoint = sub.endpoint;
    return true;
  } catch {
    endpoint = null;
    return false;
  }
}

/** Send without waiting: text/plain avoids a CORS preflight, and beacons survive the page being hidden. */
function send(path: string, body: object): void {
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.(URL_ + path, new Blob([data], { type: 'text/plain' }))) return;
  } catch {
    /* fall through */
  }
  void fetch(URL_ + path, {
    method: 'POST',
    body: data,
    keepalive: true,
    headers: { 'content-type': 'text/plain' },
  }).catch(() => {});
}

/** Ask for a push at `at` (epoch ms). */
export function schedulePush(at: number): boolean {
  if (!endpoint || !URL_) return false;
  send('/schedule', { endpoint, at });
  return true;
}

export function cancelPush(): void {
  if (endpoint && URL_) send('/cancel', { endpoint });
}

export async function unsubscribePush(): Promise<void> {
  cancelPush();
  endpoint = null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* nothing to undo */
  }
}
