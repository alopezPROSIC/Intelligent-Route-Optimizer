---
name: Online Rental Flow (Renta en Línea)
description: Architecture and key decisions for the multi-step online rental flow with identity validation and Stripe payment
---

# Online Rental Flow

## Flow: 4-step modal in `artifacts/prosic/src/components/cotizador-modal.tsx`
1. **Cotización** — equipo, días, CP → price breakdown (rates: MONTACARGAS $1800/día, PLATAFORMA $2200, TELEHANDLER $2800, GRUA $1500)
2. **Identidad** — RFC + CURP format scoring (score ≥ 60 = auto-approved, 40–59 = requires director review, <40 = blocked)
3. **Pago** — Stripe PaymentIntent in MXN; fallback message if STRIPE_NOT_CONFIGURED
4. **Confirmación** — folio + next steps

## Identity Scoring (free, no external API)
- RFC válido (formato RENAPO): +35 pts
- CURP válida (18 chars): +30 pts
- Nombre completo (≥2 palabras): +10 pts
- Email válido: +10 pts
- Teléfono 10 dígitos: +10 pts
- Dirección > 10 chars: +5 pts
- Score ≥ 60 → auto-approved; 40–59 → requires_review flag + ticket in review_requests table; < 40 → blocked

## Backend Routes (all in api-server)
- `POST /api/rentals/validate-identity` — **PUBLIC** — returns score + aprobado
- `POST /api/rentals/create-payment-intent` — **PUBLIC** — creates Stripe PI + rental record
- `POST /api/rentals/confirm/:id` — **PUBLIC** — confirms payment, sets equipment status = rentado
- `GET /api/rentals` — **PROTECTED** — list all rentals
- `GET /api/rentals/reviews` — **PROTECTED** — pending director reviews
- `PATCH /api/rentals/reviews/:id` — **PROTECTED** — approve/reject review
- `PATCH /api/rentals/:id/status` — **PROTECTED** — update rental status, auto-syncs equipment

## DB Tables (PostgreSQL, raw SQL — Drizzle schema also in lib/db/src/schema/rentals.ts)
- `rentals` — full rental record with Stripe PI id/client_secret, identity_score, requires_review
- `review_requests` — director review queue

## Equipment Status (4 values in `equipment.status` text column)
- `disponible` → `en_servicio` (when service EN_TRANSITO)
- `en_servicio` → `rentado` (when service ENTREGADO or rental confirmed)
- `rentado` → `disponible` (when service TERMINADO or rental completado/cancelado)
- `en_venta` — set manually from catalogs panel

## Stripe Integration
- Backend: `stripe` npm package, key = `STRIPE_SECRET_KEY` env var
- Frontend: `@stripe/stripe-js` + `@stripe/react-stripe-js`, key = `VITE_STRIPE_PUBLISHABLE_KEY` env var
- Currency: MXN (centavos × 100)
- Replit Stripe integration ID: `connector:ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y` (not_setup — needs ProposeIntegration)

**Why:** After ProposeIntegration is accepted, STRIPE_SECRET_KEY is injected. VITE_STRIPE_PUBLISHABLE_KEY must be set manually as an env var in the Replit project settings (it's the public key, not a secret).
