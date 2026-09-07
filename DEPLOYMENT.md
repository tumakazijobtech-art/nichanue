# NICHANUE Vercel Deployment

## Vercel settings

Root Directory: repository root
Framework Preset: Vite (or Other)
Build Command: `pnpm --filter @workspace/nichanue run build`
Output Directory: `dist`
Install Command: `corepack enable && pnpm install --frozen-lockfile`

The frontend build creates `artifacts/nichanue/dist/public`, then the package build script copies the final static site into the repository root `dist/`, which is the directory Vercel deploys.

The serverless API entry point is `api/index.ts`. Requests under `/api/*` are handled by the Express application.

Do not commit `.env`. Add production secrets in Vercel Project Settings > Environment Variables.
