# NICHANUE deployment guide (Vercel only)

Both halves of the app deploy from this one repo, to one Vercel project:

- `artifacts/nichanue` — React/Vite frontend, built to static files
- `artifacts/api-server` — Express API, run as a Vercel serverless function via `api/index.ts`

Because the frontend and API share the same Vercel domain, no `CORS_ORIGIN` or `VITE_API_URL`
is needed — the frontend calls relative paths like `/api/healthz` and Vercel routes them to
the function.

## 1. Deploy to Vercel

1. Push this repository to GitHub or another Git provider.
2. In Vercel, choose **Add New > Project** and import the repository.
3. Keep the repository root as the Vercel **Root Directory**. `vercel.json` already has the
   install/build commands, output directory, and the rewrite that sends `/api/*` to the
   serverless function.
4. Add these environment variables in the Vercel project settings:
   - `MONGODB_URI` — a MongoDB connection string
   - `MONGODB_DB` — optional, defaults to `nichanue`
   - `NICHANUE_FEE_KES` — optional, defaults to `50`
   - `PAYSTACK_SECRET_KEY` — your Paystack secret key
   - `PAYSTACK_CALLBACK_URL` — optional Paystack callback URL
   - `TALKSASA_API_KEY` — your Talk Sasa API key
   - `TALKSASA_SENDER_ID` — your approved Talk Sasa sender ID (maximum 11 characters)
   - `VERIFICATION_CODE_SECRET` — a long random secret used to hash one-time codes
   - `TALKSASA_SMS_URL` — optional; defaults to `https://bulksms.talksasa.com/api/v3/sms/send`
5. Deploy. Confirm the API is live at:

   `https://YOUR-PROJECT.vercel.app/api/healthz`

The production flow has no demo code and no fake payment path. If Talk Sasa, Paystack,
MongoDB, or the verification secret is missing, the affected operation returns an error
instead of accepting a test code or marking a payment as complete.

## 2. Local development

From the repository root:

```bash
corepack enable
pnpm install

# Terminal 1
PORT=5000 pnpm --filter @workspace/api-server run dev

# Terminal 2
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/nichanue run dev
```

The API is available at `http://localhost:5000/api`, and the frontend is available at
`http://localhost:5173`. `VITE_API_URL` can still be set locally if you want the dev frontend
to call a different API host; in the deployed Vercel app it's left unset on purpose so requests
stay same-origin.

You can also test the exact Vercel routing locally with the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## Verification-session storage

`artifacts/api-server/src/lib/nichanue-store.ts` stores verification sessions in the
`verification_sessions` MongoDB collection. This is required for Vercel because the start
and confirm requests can run in different short-lived serverless instances. Codes are
stored as HMAC hashes, expire after 10 minutes, and are limited to five attempts.

## Required production settings

- Use MongoDB in production. Live verification requires it; the in-memory fallback is only
  useful for local development of unrelated routes.
- Keep Paystack and Talk Sasa credentials only in Vercel's server-side environment variables.
  They must never be placed in `VITE_`-prefixed variables or committed to the repository.
- Same-origin deployment means cookies/CORS are simpler, but the API is still public at
  `/api/*` — don't rely on origin checks alone for anything sensitive.


## Security hardening included

The release includes production security headers, disables Express fingerprinting, limits API request bodies, uses a restrictive Content Security Policy on Vercel, and keeps payment/SMS credentials server-side. The frontend also includes a production-only browser inspection deterrent for common DevTools shortcuts and the context menu.

The DevTools deterrent is not a security boundary. A browser user can always inspect JavaScript that has been downloaded to their device. Do not put API secrets, database credentials, private signing keys, or trusted payment logic in the frontend.

Payment verification cross-checks the Paystack transaction reference, application metadata, amount, currency, and successful status before marking an application paid.
