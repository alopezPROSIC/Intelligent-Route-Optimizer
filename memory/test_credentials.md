# PROSIC – Test Credentials

## Backend / API (Express + FastAPI proxy)
Base URL: same host, `/api` prefix. Public preview URL routes /api to :8001 (uvicorn wrapper) which forwards to node on :5000.

## Seed users (login via POST /api/auth/login)
| Email                    | Password  | Rol         |
|--------------------------|-----------|-------------|
| admin@prosic.mx          | prosic123 | ADMIN       |
| operaciones@prosic.mx    | prosic123 | OPERACIONES |
| gerencia@prosic.mx       | prosic123 | GERENCIA    |

Auth: `Authorization: Bearer <token>` — token returned by /api/auth/login (stored client-side in `localStorage["prosic_token"]`).

## Database
PostgreSQL 15 local:
- URL: `postgres://prosic:prosic@127.0.0.1:5432/prosic`

## Third-party keys (env vars in /app/backend/.env)
- `STRIPE_SECRET_KEY` – **placeholder** `sk_test_emergent`. Replace with a real Stripe test secret key (sk_test_...) to enable payment intents.
- `STRIPE_WEBHOOK_SECRET` – whsec_... (optional; dev fallback uses raw JSON parsing).
- `GOOGLE_SHEETS_ID` – target Spreadsheet ID (empty by default).
- `GOOGLE_SERVICE_ACCOUNT_KEY` – raw JSON or base64 of service-account credentials JSON.

## Frontend env
- `/app/frontend/.env` → `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (replace).
