# NICHANUE

Professional English four-step workflow for verified loan-access enquiries, Paystack fee collection, and downloadable Nichanue ID tickets.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Optional env: `MONGODB_URI`, `MONGODB_DB`, `NICHANUE_FEE_KES`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CALLBACK_URL`, `TALKSASA_API_KEY`, `TALKSASA_VERIFY_START_URL`, `TALKSASA_VERIFY_CONFIRM_URL`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nichanue/src/App.tsx` — the four-step English applicant experience
- `artifacts/nichanue/src/index.css` — NICHANUE visual tokens and responsive styling
- `artifacts/api-server/src/routes/nichanue.ts` — verification, application, Paystack, and ticket endpoints
- `artifacts/api-server/src/lib/nichanue-store.ts` — MongoDB-backed store with safe in-memory fallback for local/demo mode
- `lib/api-spec/openapi.yaml` — source of truth for the generated API hooks and schemas

## Architecture decisions

- Paystack and Talk Sasa are server-side REST integrations configured through environment variables; credentials never reach the browser.
- Missing provider credentials intentionally enables demo mode so the four-step journey can be previewed without claiming a real payment or phone verification.
- MongoDB stores configurable fee settings and applications; the temporary memory store is only a local fallback when MongoDB is not configured.
- The downloadable ticket is an ID confirmation document and explicitly does not claim to be a CRB report or a loan approval.

## Product

NICHANUE collects a user's name, phone number, and loan-access needs in English; verifies the phone through Talk Sasa, charges the configured service fee through Paystack, and generates a PDF Nichanue ID ticket after payment.

## User preferences

- Keep the applicant flow simple, professional, English-first, and limited to four clear steps.

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before typechecking frontend or backend callers.
- Configure Talk Sasa endpoint URLs as well as its API key before turning off demo mode.
- The default fee is KES 50 until MongoDB settings or `NICHANUE_FEE_KES` overrides it.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
