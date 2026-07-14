import { Router } from "express";
import { db, quotesTable, postalZonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const RENTAL_RATES: Record<string, number> = {
  "MONTACARGAS": 350,
  "PLATAFORMA": 280,
  "TELEHANDLER": 420,
  "GRUA": 500,
  "DEFAULT": 300,
};

function getRentalRate(modelo: string): number {
  const upper = modelo.toUpperCase();
  for (const [key, rate] of Object.entries(RENTAL_RATES)) {
    if (upper.includes(key)) return rate;
  }
  return RENTAL_RATES.DEFAULT;
}

// POST /api/quotes/validate-identity
router.post("/quotes/validate-identity", async (req, res) => {
  const { tipo_persona, rfc, nombre } = req.body;
  if (!rfc) {
    res.status(400).json({ error: "RFC requerido" });
    return;
  }
  // Validate RFC format
  const rfcFisicaRegex = /^[A-Z]{4}\d{6}[A-Z0-9]{3}$/;
  const rfcMoralRegex = /^[A-Z]{3}\d{6}[A-Z0-9]{3}$/;
  const cleanRfc = rfc.toUpperCase().trim();
  const valido = tipo_persona === "FISICA" ? rfcFisicaRegex.test(cleanRfc) : rfcMoralRegex.test(cleanRfc);

  res.json({
    valido,
    tipo_persona,
    nombre_registrado: nombre || null,
    rfc_verificado: valido,
    observaciones: valido ? "RFC válido y verificado" : "Formato de RFC inválido para " + tipo_persona,
  });
});

// GET /api/quotes/postal-zones
router.get("/quotes/postal-zones", async (req, res) => {
  const { cp } = req.query;
  if (!cp) {
    res.status(400).json({ error: "Código postal requerido" });
    return;
  }
  const [zone] = await db.select().from(postalZonesTable).where(eq(postalZonesTable.codigo_postal, String(cp)));
  if (!zone) {
    // Return a default zone if CP not found
    res.json({
      codigo_postal: String(cp),
      municipio: "No registrado",
      estado: "México",
      zona: "ZONA_3",
      tarifa_flete: 2800,
      tiempo_estimado_hrs: 4,
    });
    return;
  }
  res.json(zone);
});

// POST /api/quotes
router.post("/quotes", async (req, res) => {
  const { codigo_postal, modelo, dias_renta, tipo_persona, rfc, nombre_empresa, nombre_contacto, telefono, email, notas, serie, direccion_entrega } = req.body;

  const [zone] = await db.select().from(postalZonesTable).where(eq(postalZonesTable.codigo_postal, codigo_postal));
  const costo_flete = zone?.tarifa_flete ?? 2800;
  const costo_renta_diaria = getRentalRate(modelo);
  const subtotal = costo_flete + costo_renta_diaria * dias_renta;
  const iva = subtotal * 0.16;
  const monto_total = subtotal + iva;
  const folio = `COT-${Date.now()}`;
  const vigencia = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); // 15 days

  const [quote] = await db.insert(quotesTable).values({
    folio,
    codigo_postal,
    zona: zone?.zona ?? "ZONA_3",
    modelo,
    serie: serie ?? null,
    dias_renta,
    tipo_persona,
    nombre_empresa: nombre_empresa ?? null,
    rfc: rfc ?? null,
    nombre_contacto: nombre_contacto ?? null,
    telefono: telefono ?? null,
    email: email ?? null,
    direccion_entrega: direccion_entrega ?? null,
    notas: notas ?? null,
    costo_flete,
    costo_renta_diaria,
    subtotal,
    iva,
    monto_total,
    estatus: "BORRADOR",
    identidad_verificada: false,
    vigencia,
  }).returning();
  res.status(201).json(quote);
});

// GET /api/quotes
router.get("/quotes", async (req, res) => {
  const { estatus } = req.query;
  let rows = await db.select().from(quotesTable);
  if (estatus) rows = rows.filter(r => r.estatus === estatus);
  res.json(rows);
});

// GET /api/quotes/:id
router.get("/quotes/:id", async (req, res) => {
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, Number(req.params.id)));
  if (!quote) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(quote);
});

export default router;
