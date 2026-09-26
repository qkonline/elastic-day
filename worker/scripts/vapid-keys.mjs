// Prints a new VAPID key pair for the push worker.
//   public  → worker/wrangler.toml (VAPID_PUBLIC_KEY) and .env.production (VITE_VAPID_PUBLIC_KEY)
//   private → `wrangler secret put VAPID_PRIVATE_KEY` (never commit it)
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const b64url = (b) => Buffer.from(b).toString('base64url');
console.log('public: ', b64url(await crypto.subtle.exportKey('raw', pair.publicKey)));
console.log('private:', (await crypto.subtle.exportKey('jwk', pair.privateKey)).d);
