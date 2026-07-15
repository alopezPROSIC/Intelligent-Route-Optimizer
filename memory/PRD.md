# PROSIC – Product Requirements Document (PRD)

## Original Problem Statement
Continuar la implementación del pago en línea (Stripe) y la conexión con Google Sheets. Meta: convertir a PROSIC en un "cerebro empresarial" con módulos operando en tiempo real (flujo 360°: marketing → ventas → operaciones → RRHH → soporte → contabilidad → gobernanza).

Fase actual entregada: **Pagos en línea (Stripe) + Google Sheets sync real**, cimientos para las automatizaciones cross-módulo.

## Architecture
- **Backend (Express 5 + TypeScript + Drizzle ORM + PostgreSQL)** en `/app/artifacts/api-server`, puerto 5000.
- **Wrapper FastAPI** (`/app/backend/server.py`) en puerto 8001 – hace reverse-proxy de `/api/*` al Node backend para encajar con el supervisor de Emergent.
- **Frontend (Vite + React 19)** en `/app/artifacts/prosic`, servido en `/app/frontend` como wrapper que arranca vite en puerto 3000, con `proxy` `/api → 127.0.0.1:8001`.
- **PostgreSQL 15** local (`postgres://prosic:prosic@127.0.0.1:5432/prosic`).
- **pnpm workspaces** en la raíz.

## User Personas
- **Cliente final** – solicita cotización, valida identidad, paga en línea (Stripe MXN).
- **Vendedor / Operaciones** – gestiona rentas, servicios, cotizaciones, revisiones de identidad.
- **Gerencia** – aprueba revisiones, sincroniza Google Sheets, ve KPIs.
- **Contabilidad / auditoría** – historial de pagos idempotente (`payment_transactions`) y de sync (`sheets_sync_log`).

## Core Requirements
1. Cotizador público → cálculo de flete por CP + IVA 16%.
2. Validación de identidad (RFC/CURP + scoring gratuito).
3. **Stripe** PaymentIntent, tabla `payment_transactions` con idempotencia (`processed=0/1`), estado consultable via polling, webhook `POST /api/webhook/stripe` para `payment_intent.succeeded / failed`.
4. **Google Sheets** con Service Account: `/api/sheets/status`, `/api/sheets/sync` (import/export/bidirectional), `/api/sheets/import`, `/api/sheets/history`. Tabla `sheets_sync_log` con auditoría.
5. Automatización cross-módulo: pago exitoso → renta pasa a `pagado` → equipo pasa a `rentado` → activity_log auditado (una sola vez, idempotente).

## What's Been Implemented (2026-01-15)
- ✅ Wrappers `/app/backend` (FastAPI proxy) y `/app/frontend` (yarn start → vite) para compatibilidad con supervisor Emergent.
- ✅ PostgreSQL local + drizzle-kit push del schema completo (14 tablas).
- ✅ Nuevas tablas: `payment_transactions`, `sheets_sync_log`, columna `equipment.status`.
- ✅ Stripe Node SDK: PaymentIntent + recompute server-side de totales + payment_transactions idempotente + confirm endpoint + polling endpoint `GET /api/rentals/payment-status/:pi` + webhook `POST /api/webhook/stripe` (mounted before express.json para raw body).
- ✅ Google Sheets real vía `googleapis` con Service Account (JSON crudo o base64) o `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`.
  - Export: escribe hojas servicios, CLIENTES, flota, conductores_proveedores, equipos.
  - Import: lee REPORTE u otra hoja → inserta en `services` (o `clients` para tab CLIENTES).
  - Historial persistente + activity_log.
- ✅ Seed: 3 usuarios (admin/operaciones/gerencia password `prosic123`), 5 códigos postales, 2 sucursales, 4 equipos.
- ✅ Autenticación por token existente funcional (SHA-256 con salt).

## Backlog / Priorities

### P0 – Bloquea producción
- Stripe: reemplazar `sk_test_emergent` por una llave real de test para transacciones reales. La app responde 503 STRIPE_NOT_CONFIGURED cuando no está.
- Google Sheets: proveer `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_KEY` para activar sync real.

### P1 – Automatizaciones cross-módulo del flujo 360°
- Fase 1 Marketing: rastreador de links + chat en vivo + citas → CRM.
- Fase 2 Ventas: firma electrónica + generación de contrato PDF.
- Fase 3 Ops: órdenes de compra automáticas cuando stock < mínimo; MRO ligado a fabricación.
- Fase 4 Proyectos: hojas de horas + gastos → costo real vs estimado con alarma > 5%.
- Fase 5 RRHH: reloj biométrico → asistencias → vacaciones automáticas.
- Fase 6 Soporte: tickets desde chat → helpdesk → orden de reparación.
- Fase 7 Contabilidad: valuación FIFO + asientos automáticos + conciliación bancaria.
- Fase 8 Gobernanza: alertas de saturación + encuestas → CRM.

### P2 – Mejoras UX/observabilidad
- Dashboard en tiempo real con websockets (Stripe webhook → invalidar queries React Query).
- Auditoría con hashing encadenado (block-chain de eventos).
- Exportar a Sheets como cron programado.

## Next Action Items
1. **Usuario**: aportar Stripe test key real + Google Spreadsheet ID + service-account JSON.
2. Extender importación de Sheets a más tabs (equipos, flota, conductores_proveedores).
3. Añadir cron programado (`webhook-crond`) para sync bidireccional cada N minutos.
4. Iniciar Fase 1 (rastreador de links + citas) para desbloquear resto del flujo 360°.
