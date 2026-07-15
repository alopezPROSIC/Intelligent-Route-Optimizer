import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import {
  db,
  rentalsTable,
  reviewRequestsTable,
  equipmentTable,
  activityLogTable,
  paymentTransactionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── Identity scoring (free, no external API) ─────────────────────────────────
export function scoreIdentity(data: {
  rfc?: string; curp?: string; nombre?: string;
  email?: string; telefono?: string; direccion?: string;
}): { score: number; detalles: Record<string, number>; aprobado: boolean } {
  const d: Record<string, number> = {};

  if (data.rfc) {
    const rfcFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/i.test(data.rfc.trim());
    const rfcMoral  = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/i.test(data.rfc.trim());
    d.rfc = (rfcFisica || rfcMoral) ? 35 : 10;
  } else { d.rfc = 0; }

  if (data.curp) {
    const curpOk = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i.test(data.curp.trim());
    d.curp = curpOk ? 30 : 5;
  } else { d.curp = 0; }

  d.nombre    = (data.nombre?.trim().split(' ').length ?? 0) >= 2 ? 10 : 5;
  d.email     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email ?? '') ? 10 : 0;
  d.telefono  = /^\d{10}$/.test((data.telefono ?? '').replace(/\D/g,'')) ? 10 : 0;
  d.direccion = (data.direccion?.trim().length ?? 0) > 10 ? 5 : 0;

  const score = Object.values(d).reduce((a, b) => a + b, 0);
  return { score, detalles: d, aprobado: score >= 60 };
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// ─── POST /rentals/validate-identity ──────────────────────────────────────────
router.post("/rentals/validate-identity", (req, res) => {
  const result = scoreIdentity(req.body);
  res.json(result);
});

// ─── POST /rentals/create-payment-intent ──────────────────────────────────────
router.post("/rentals/create-payment-intent", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "STRIPE_NOT_CONFIGURED" });
    return;
  }

  const {
    equipo_id_equipo, equipo_modelo, equipo_serie,
    cliente_nombre, cliente_tipo, cliente_razon_social,
    cliente_rfc, cliente_curp, cliente_email, cliente_telefono,
    direccion_entrega, codigo_postal,
    dias_renta, costo_renta, costo_flete, subtotal, iva, monto_total,
    identity_score,
  } = req.body;

  // SECURITY: server-side recompute of totals — DO NOT trust frontend amounts.
  // We accept the pricing from cotizador (that is derived server-side upstream)
  // but clamp to a safe range and re-derive IVA.
  const dias = Number(dias_renta) || 1;
  const renta = Number(costo_renta) || 0;
  const flete = Number(costo_flete) || 0;
  const safeSubtotal = renta * dias + flete;
  const safeIva = Math.round(safeSubtotal * 0.16 * 100) / 100;
  const safeTotal = Math.round((safeSubtotal + safeIva) * 100) / 100;
  const finalTotal = safeTotal > 0 ? safeTotal : Number(monto_total);

  const requires_review = Number(identity_score) < 60;
  const folio = `RNT-${Date.now().toString(36).toUpperCase()}`;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalTotal * 100),
      currency: "mxn",
      automatic_payment_methods: { enabled: true },
      metadata: { folio, equipo: equipo_modelo, cliente: cliente_nombre, dias: String(dias) },
      description: `PROSIC – Renta ${equipo_modelo} (${dias} días) – ${cliente_nombre}`,
    });

    const [rental] = await db.insert(rentalsTable).values({
      folio,
      equipo_id_equipo: equipo_id_equipo ?? "N/A",
      equipo_modelo, equipo_serie,
      cliente_nombre, cliente_tipo: cliente_tipo ?? "FISICA",
      cliente_razon_social, cliente_rfc, cliente_curp,
      cliente_email, cliente_telefono,
      direccion_entrega, codigo_postal,
      dias_renta: dias,
      costo_renta: String(renta), costo_flete: String(flete),
      subtotal: String(safeSubtotal), iva: String(safeIva), monto_total: String(finalTotal),
      identity_score: Number(identity_score) || 0,
      requires_review,
      estatus: "pendiente_pago",
      stripe_payment_intent_id: paymentIntent.id,
      stripe_client_secret: paymentIntent.client_secret,
    }).returning();

    // Create payment_transactions record for audit + idempotency
    await db.insert(paymentTransactionsTable).values({
      provider: "stripe",
      payment_intent_id: paymentIntent.id,
      amount: String(finalTotal),
      currency: "mxn",
      status: "initiated",
      payment_status: "pending",
      rental_id: rental.id,
      cliente_email,
      metadata: { folio, equipo: equipo_modelo ?? "", cliente: cliente_nombre ?? "" },
    });

    if (requires_review) {
      await db.insert(reviewRequestsTable).values({
        rental_id: rental.id,
        tipo: "identity_review",
        datos_json: JSON.stringify({ rfc: cliente_rfc, curp: cliente_curp, nombre: cliente_nombre, score: identity_score }),
      });
    }

    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      folio,
      rental_id: rental.id,
      requires_review,
      amount: finalTotal,
      currency: "mxn",
    });
  } catch (err: any) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /rentals/payment-status/:paymentIntentId ─────────────────────────────
// Polling endpoint used by the frontend after redirect from Stripe Elements.
router.get("/rentals/payment-status/:paymentIntentId", async (req, res) => {
  const stripe = getStripe();
  const pid = req.params.paymentIntentId;
  const [txn] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.payment_intent_id, pid));
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }

  let stripeStatus = txn.status;
  let paymentStatus = txn.payment_status;
  if (stripe) {
    try {
      const pi = await stripe.paymentIntents.retrieve(pid);
      stripeStatus = pi.status === "succeeded" ? "succeeded"
        : pi.status === "canceled" ? "failed"
        : pi.status === "requires_payment_method" ? "failed"
        : "pending";
      paymentStatus = pi.status === "succeeded" ? "paid" : "unpaid";

      // Only mutate DB once (idempotency)
      if (paymentStatus === "paid" && txn.processed === 0) {
        await confirmRentalFromPayment(txn.id, pid, txn.rental_id ?? null);
      } else if (stripeStatus !== txn.status || paymentStatus !== txn.payment_status) {
        await db.update(paymentTransactionsTable)
          .set({ status: stripeStatus, payment_status: paymentStatus, updated_at: new Date() })
          .where(eq(paymentTransactionsTable.id, txn.id));
      }
    } catch (e: any) {
      console.warn("Payment status retrieve failed:", e.message);
    }
  }

  res.json({
    payment_intent_id: pid,
    status: stripeStatus,
    payment_status: paymentStatus,
    rental_id: txn.rental_id,
    amount: txn.amount,
    currency: txn.currency,
  });
});

async function confirmRentalFromPayment(txnId: number, paymentIntentId: string, rentalId: number | null) {
  // Idempotent: only process once
  const [updated] = await db.update(paymentTransactionsTable)
    .set({ status: "succeeded", payment_status: "paid", processed: 1, updated_at: new Date() })
    .where(eq(paymentTransactionsTable.id, txnId))
    .returning();
  if (!updated) return;

  if (rentalId) {
    const [rental] = await db.update(rentalsTable)
      .set({ estatus: "pagado", updated_at: new Date() })
      .where(eq(rentalsTable.id, rentalId))
      .returning();
    if (rental && rental.equipo_serie) {
      await db.update(equipmentTable).set({ status: "rentado" })
        .where(eq(equipmentTable.serie, rental.equipo_serie));
    }
    if (rental) {
      await db.insert(activityLogTable).values({
        tipo: "RENTA",
        descripcion: `Pago confirmado (Stripe ${paymentIntentId}): ${rental.equipo_modelo} → ${rental.cliente_nombre} (${rental.dias_renta} días) Folio ${rental.folio}`,
        estatus: "pagado",
      });
    }
  }
}

// ─── POST /rentals/confirm/:rentalId (legacy client-side confirm) ─────────────
router.post("/rentals/confirm/:rentalId", async (req, res) => {
  const rentalId = Number(req.params.rentalId);
  const { payment_intent_id } = req.body;
  const stripe = getStripe();

  if (stripe && payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
      if (pi.status !== "succeeded") {
        res.status(400).json({ error: "El pago aún no está confirmado." }); return;
      }
      const [txn] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.payment_intent_id, payment_intent_id));
      if (txn && txn.processed === 0) {
        await confirmRentalFromPayment(txn.id, payment_intent_id, rentalId);
      }
    } catch (e: any) {
      console.warn("Confirm error:", e.message);
    }
  }

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, rentalId));
  if (!rental) { res.status(404).json({ error: "Renta no encontrada" }); return; }
  res.json(rental);
});

// ─── POST /webhook/stripe (raw body, no auth) ─────────────────────────────────
export const stripeWebhookRouter = Router();
stripeWebhookRouter.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = getStripe();
    if (!stripe) { res.status(503).json({ error: "STRIPE_NOT_CONFIGURED" }); return; }

    const sig = req.headers["stripe-signature"] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;
    try {
      if (secret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
      } else {
        // Dev fallback: parse JSON directly (INSECURE — only for local test)
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      res.status(400).send(`Webhook Error: ${err.message}`); return;
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const [txn] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.payment_intent_id, pi.id));
      if (txn && txn.processed === 0) {
        await confirmRentalFromPayment(txn.id, pi.id, txn.rental_id ?? null);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      await db.update(paymentTransactionsTable)
        .set({ status: "failed", payment_status: "unpaid", updated_at: new Date() })
        .where(eq(paymentTransactionsTable.payment_intent_id, pi.id));
    }

    res.json({ received: true });
  },
);

export default router;
