# NICHANUE deployment guide

This repository contains two deployable services:

- `artifacts/nichanue` — React/Vite frontend for Vercel
- `artifacts/api-server` — Express API for Render

The frontend and API are deployed separately. The frontend calls the API through the `VITE_API_URL` environment variable.

## 1. Deploy the API to Render

1. Push this repository to GitHub or another Git provider.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render will read `render.yaml` and create the `nichanue-api` web service.
4. Set the secret values requested by Render:
   - `CORS_ORIGIN` — your final Vercel URL, for example `https://nichanue.vercel.app`
   - `MONGODB_URI` — a MongoDB connection string
   - `PAYSTACK_SECRET_KEY` — your Paystack secret key
   - `PAYSTACK_CALLBACK_URL` — optional Paystack callback URL
   - `TALKSASA_API_KEY` — your Talk Sasa API key
   - `TALKSASA_VERIFY_START_URL` — Talk Sasa verification-start endpoint
   - `TALKSASA_VERIFY_CONFIRM_URL` — Talk Sasa verification-confirm endpoint
5. Deploy the service and copy its public URL.
6. Confirm it is healthy by opening:

   `https://YOUR-RENDER-SERVICE.onrender.com/api/healthz`

If the Talk Sasa and Paystack variables are not configured, the API intentionally runs in demo mode. Demo mode accepts verification code `1234` and does not charge a real payment.

## 2. Deploy the frontend to Vercel

1. In Vercel, choose **Add New > Project** and import the same repository.
2. Keep the repository root as the Vercel **Root Directory**. `vercel.json` already contains the build settings.
3. Add this environment variable:

   - `VITE_API_URL` — the public Render API URL, for example `https://nichanue-api.onrender.com`

   Do not add `/api` to the value; the frontend adds the API path itself.
4. Deploy the project.
5. Copy the final Vercel URL and update the Render `CORS_ORIGIN` variable if the URL changed. Redeploy the Render service after changing it.

## 3. Local development

From the repository root:

```bash
corepack enable
pnpm install

# Terminal 1
PORT=5000 pnpm --filter @workspace/api-server run dev

# Terminal 2
PORT=5173 BASE_PATH=/ VITE_API_URL=http://localhost:5000 pnpm --filter @workspace/nichanue run dev
```

The API is available at `http://localhost:5000/api`, and the frontend is available at `http://localhost:5173`.

## Required production settings

- Use MongoDB in production. The in-memory fallback is temporary and is not suitable for persistent applications.
- Keep Paystack and Talk Sasa credentials only in Render environment variables. They must never be placed in frontend variables or committed to the repository.
- `VITE_API_URL` is public by design. It is only the API base URL and must not contain a secret.
- `CORS_ORIGIN` should contain the exact Vercel origin. Multiple origins can be separated by commas.