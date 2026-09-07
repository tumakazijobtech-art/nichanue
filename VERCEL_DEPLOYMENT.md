# NICHANUE Vercel Deployment

## Vercel project settings

Set the Vercel Root Directory to the repository root.

The repository is a pnpm workspace. The included `vercel.json` handles the frontend build and publishes the generated static files from the root `dist` directory.

## Build

Vercel runs:

`pnpm --filter @workspace/nichanue run build && rm -rf dist && cp -R artifacts/nichanue/dist/public dist`

The API is exposed through `/api` using `api/index.ts`.

## Environment variables

Copy the variables from `.env.example` into Vercel Project Settings > Environment Variables. Never commit a real `.env` file.

Required production variables include MongoDB, Paystack, TalkSasa and `VERIFICATION_CODE_SECRET` values used by the application.

## Important

`PAYSTACK_SECRET_KEY`, `TALKSASA_API_KEY`, `MONGODB_URI`, and `VERIFICATION_CODE_SECRET` must remain server side. Do not prefix these secrets with `VITE_`.
