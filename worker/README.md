# Push worker

Sends Elastic Day's time's-up notifications while the app is closed or the phone is locked.

- `POST /schedule` with `{ "endpoint": "<push subscription endpoint>", "at": <epoch ms> }` books a push.
- `POST /cancel` with `{ "endpoint": "…" }` cancels it.

Each browser gets a Durable Object (named after its push endpoint) that stores the endpoint and sets an alarm; when the alarm fires it sends an empty, VAPID-signed push and forgets the endpoint. Pushes carry no payload, so no task data ever reaches the worker. Requests are only accepted from the origins in `ALLOWED_ORIGINS`, for the browsers' own push services, and for times within the next 24 hours.

```bash
npx wrangler dev                             # local, with the private key in .dev.vars
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler deploy
```

Wrangler needs Node 22 or newer. `scripts/vapid-keys.mjs` generates a key pair.
