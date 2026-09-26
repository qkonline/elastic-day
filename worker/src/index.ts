// Elastic Day push worker. When the app goes into the background with a timer running, it
// asks for a push at the moment time runs out; coming back to the front cancels it. Each
// browser gets a Durable Object (keyed by its push address) holding that address and an
// alarm. The push is empty: the app's service worker fills in the task from its own data,
// so nothing about anyone's plan reaches this worker.

import { DurableObject } from 'cloudflare:workers';
import { isBookableTime, isPushEndpoint } from './checks';
import { vapidAuthorization, type VapidKeys } from './vapid';

export interface Env extends VapidKeys {
  TIMERS: DurableObjectNamespace<Timer>;
  /** Comma-separated origins allowed to call this worker. */
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(req, env): Promise<Response> {
    const origin = req.headers.get('origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',').some((o) => o.trim() === origin);
    const cors: Record<string, string> = allowed
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST',
          'access-control-max-age': '86400',
          vary: 'origin',
        }
      : {};
    const reply = (status: number) => new Response(null, { status, headers: cors });

    if (req.method === 'OPTIONS') return reply(allowed ? 204 : 403);
    const { pathname } = new URL(req.url);
    if (req.method !== 'POST' || (pathname !== '/schedule' && pathname !== '/cancel')) return reply(404);
    if (!allowed) return reply(403);

    // The app sends text/plain (via sendBeacon) so no preflight is needed.
    let body: { endpoint?: unknown; at?: unknown };
    try {
      const text = await req.text();
      if (text.length > 2048) return reply(413);
      body = JSON.parse(text);
    } catch {
      return reply(400);
    }
    if (!isPushEndpoint(body.endpoint)) return reply(400);

    const timer = env.TIMERS.get(env.TIMERS.idFromName(body.endpoint));
    if (pathname === '/cancel') {
      await timer.cancel();
      return reply(204);
    }
    if (!isBookableTime(body.at)) return reply(400);
    await timer.book(body.endpoint, body.at);
    return reply(204);
  },
} satisfies ExportedHandler<Env>;

/** One per browser: the pending time's-up push for that browser, if any. */
export class Timer extends DurableObject<Env> {
  async book(endpoint: string, at: number): Promise<void> {
    await this.ctx.storage.put('endpoint', endpoint);
    await this.ctx.storage.setAlarm(Math.max(at, Date.now()));
  }

  async cancel(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async alarm(): Promise<void> {
    const endpoint = await this.ctx.storage.get<string>('endpoint');
    await this.ctx.storage.deleteAll();
    if (!endpoint) return;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: await vapidAuthorization(endpoint, this.env),
        ttl: '1800', // if the phone is offline, still worth showing for half an hour
        urgency: 'high',
      },
    });
    // 404/410: the browser dropped its subscription; nothing to do.
    if (!res.ok && res.status !== 404 && res.status !== 410) console.warn('push failed', res.status, await res.text());
  }
}
