import { Router } from "express";
import { db, servicesTable, activityLogTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/services/today", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db.select().from(servicesTable)
    .where(and(eq(servicesTable.fecha_programacion, today), eq(servicesTable.es_retorno_base, false)));
  res.json(rows);
});

router.get("/services/pending-collection", async (req, res) => {
  const rows = await db.select().from(servicesTable)
    .where(and(eq(servicesTable.operacion, "R"), eq(servicesTable.es_retorno_base, false)));
  res.json(rows.filter(r => r.estatus === "PENDIENTE" || r.estatus === "PROGRAMADO"));
});

router.get("/services", async (req, res) => {
  const { estatus, fecha_desde, fecha_hasta, conductor_id, vehiculo_id, operacion, tipo_servicio } = req.query;
  let rows = await db.select().from(servicesTable).where(eq(servicesTable.es_retorno_base, false));

  if (estatus) rows = rows.filter(r => r.estatus === estatus);
  if (operacion) rows = rows.filter(r => r.operacion === operacion);
  if (tipo_servicio) rows = rows.filter(r => r.tipo_servicio === tipo_servicio);
  if (conductor_id) rows = rows.filter(r => r.conductor_id === Number(conductor_id));
  if (vehiculo_id) rows = rows.filter(r => r.vehiculo_id === Number(vehiculo_id));
  if (fecha_desde) rows = rows.filter(r => r.fecha_programacion && r.fecha_programacion >= String(fecha_desde));
  if (fecha_hasta) rows = rows.filter(r => r.fecha_programacion && r.fecha_programacion <= String(fecha_hasta));

  res.json(rows);
});

router.post("/services", async (req, res) => {
  const [service] = await db.insert(servicesTable).values({ ...req.body, es_retorno_base: false }).returning();
  // Log activity
  await db.insert(activityLogTable).values({
    tipo: "SERVICIO",
    descripcion: `Nuevo servicio ${service.operacion} creado para ${service.cliente || "cliente"}`,
    usuario: (req as any).user?.nombre,
    servicio_id: service.id,
    estatus: service.estatus,
  });
  res.status(201).json(service);
});

router.get("/services/:id", async (req, res) => {
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, Number(req.params.id)));
  if (!service) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(service);
});

router.put("/services/:id", async (req, res) => {
  const [service] = await db.update(servicesTable)
    .set({ ...req.body, updated_at: new Date() })
    .where(eq(servicesTable.id, Number(req.params.id)))
    .returning();
  if (!service) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(service);
});

router.delete("/services/:id", async (req, res) => {
  await db.delete(servicesTable).where(eq(servicesTable.id, Number(req.params.id)));
  res.status(204).send();
});

router.patch("/services/:id/status", async (req, res) => {
  const { estatus, comentario } = req.body;
  const [service] = await db.update(servicesTable)
    .set({ estatus, updated_at: new Date() })
    .where(eq(servicesTable.id, Number(req.params.id)))
    .returning();
  if (!service) { res.status(404).json({ error: "No encontrado" }); return; }
  if (comentario) {
    await db.insert(activityLogTable).values({
      tipo: "SERVICIO",
      descripcion: `Estatus actualizado a ${estatus}: ${comentario}`,
      usuario: (req as any).user?.nombre,
      servicio_id: service.id,
      estatus,
    });
  }
  res.json(service);
});

export default router;
