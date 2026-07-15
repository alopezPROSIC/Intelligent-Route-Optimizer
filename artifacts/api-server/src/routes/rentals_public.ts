import { Router } from "express";
import Stripe from "stripe";
import { db, rentalsTable, reviewRequestsTable, equipmentTable, activityLogTable } from "@workspace/db";
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

// ─── POST /rentals/validate-identity ──────────────────────────────────────────
router.post("/rentals/validate-identity", (req, res) => {
  const result = scoreIdentity(req.body);
  res.json(result);
});

// ─── POST /rentals/create-payment-intent ──────────────────────────────────────
router.post("/rentals/create-payment-intent", async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "STRIPE_NOT_CONFIGURED" });
    return;
  }

  const stripe = new Stripe(stripeKey);
  const {
    equipo_id_equipo, equipo_modelo, equipo_serie,
    cliente_nombre, cliente_tipo, cliente_razon_social,
    cliente_rfc, cliente_curp, cliente_email, cliente_telefono,
    direccion_entrega, codigo_postal,
    dias_renta, costo_renta, costo_flete, subtotal, iva, monto_total,
    identity_score,
  } = req.body;

  const requires_review = Number(identity_score) < 60;
  const folio = `RNT-${Date.now().toString(36).toUpperCase()}`;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(monto_total) * 100),
      currency: "mxn",
      automatic_payment_methods: { enabled: true },
      metadata: { folio, equipo: equipo_modelo, cliente: cliente_nombre, dias: String(dias_renta) },
      description: `PROSIC – Renta ${equipo_modelo} (${dias_renta} días) – ${cliente_nombre}`,
    });

    const [rental] = await db.insert(rentalsTable).values({
      folio,
      equipo_id_equipo: equipo_id_equipo ?? "N/A",
      equipo_modelo, equipo_serie,
      cliente_nombre, cliente_tipo: cliente_tipo ?? "FISICA",
      cliente_razon_social, cliente_rfc, cliente_curp,
      cliente_email, cliente_telefono,
      direccion_entrega, codigo_postal,
      dias_renta: Number(dias_renta),
      costo_renta: String(costo_renta), costo_flete: String(costo_flete),
      subtotal: String(subtotal), iva: String(iva), monto_total: String(monto_total),
      identity_score: Number(identity_score),
      requires_review,
      estatus: "pendiente_pago",
      stripe_payment_intent_id: paymentIntent.id,
      stripe_client_secret: paymentIntent.client_secret,
    }).returning();

    if (requires_review) {
      await db.insert(reviewRequestsTable).values({
        rental_id: rental.id,
        tipo: "identity_review",
        datos_json: JSON.stringify({ rfc: cliente_rfc, curp: cliente_curp, nombre: cliente_nombre, score: identity_score }),
      });
    }

    res.json({ client_secret: paymentIntent.client_secret, folio, rental_id: rental.id, requires_review });
  } catch (err: any) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /rentals/confirm/:rentalId ──────────────────────────────────────────
router.post("/rentals/confirm/:rentalId", async (req, res) => {
  const rentalId = Number(req.params.rentalId);
  const { payment_intent_id } = req.body;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && payment_intent_id) {
    try {
      const stripe = new Stripe(stripeKey);
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
      if (pi.status !== "succeeded") {
        res.status(400).json({ error: "El pago aún no está confirmado." }); return;
      }
    } catch { /* continuar si Stripe falla al verificar */ }
  }

  const [rental] = await db.update(rentalsTable)
    .set({ estatus: "pagado", updated_at: new Date() })
    .where(eq(rentalsTable.id, rentalId))
    .returning();

  if (!rental) { res.status(404).json({ error: "Renta no encontrada" }); return; }

  if (rental.equipo_serie) {
    await db.update(equipmentTable).set({ status: "rentado" })
      .where(eq(equipmentTable.serie, rental.equipo_serie));
  }

  await db.insert(activityLogTable).values({
    tipo: "RENTA",
    descripcion: `Renta confirmada: ${rental.equipo_modelo} → ${rental.cliente_nombre} (${rental.dias_renta} días) Folio ${rental.folio}`,
    estatus: "pagado",
  });

  res.json(rental);
});

export default router;
