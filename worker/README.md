# Push worker

Sends Elastic Day's notifications (time's up, and heads-ups before fixed-time tasks) while the app is closed or the phone is locked.

- `POST /schedule` with `{ "endpoint": "<push subscription endpoint>", "at": [<epoch ms>, …] }` books a push at each time (up to 20), replacing any booked before. A single number is accepted too.
- `POST /cancel` with `{ "endpoint": "…" }` cancels them.

Each browser gets a Durable Object (named after its push endpoint) that stores the endpoint and the times and sets an alarm for the earliest; when the alarm fires it sends an empty, VAPID-signed push and sets the alarm for the next time, forgetting the endpoint after the last. Pushes carry no payload, so no task data ever reaches the worker. Requests are only accepted from the origins in `ALLOWED_ORIGINS`, for the browsers' own push services, and for times within the next 24 hours.

```bash
npx wrangler dev                             # local, with the private key in .dev.vars
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler deploy
```

Wrangler needs Node 22 or newer. `scripts/vapid-keys.mjs` generates a key pair.
