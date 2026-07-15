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

## Third-party keys – configurar desde la UI **`/settings`** (recomendado)

Inicia sesión con `admin@prosic.mx / prosic123`, navega a "Ajustes" en la barra lateral, pega tus valores y presiona el ícono guardar. Botones "Probar conexión" validan Stripe y Google Sheets antes de usarlos en producción.

Alternativa (env vars en `/app/backend/.env` – solo si prefieres):
- `STRIPE_SECRET_KEY` – vacío por defecto. UI la sobrescribe si está configurada.
- `STRIPE_WEBHOOK_SECRET`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY` – ídem.

Valores guardados en tabla `app_settings` (source of truth). Endpoints:
- `GET /api/settings` – vista enmascarada (admin/gerencia).
- `PUT /api/settings/:key` – guarda un valor (con validación de formato).
- `POST /api/settings/test/stripe` – valida el key contra Stripe API.
- `POST /api/settings/test/sheets` – abre la hoja y lista las pestañas.

## Frontend env
- `/app/frontend/.env` → `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` (replace).
