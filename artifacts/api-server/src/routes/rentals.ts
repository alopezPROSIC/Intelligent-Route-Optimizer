// Protected rental routes (require auth)
import { Router } from "express";
import { db, rentalsTable, reviewRequestsTable, equipmentTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/rentals", async (_req, res) => {
  const rows = await db.select().from(rentalsTable).orderBy(rentalsTable.created_at);
  res.json(rows);
});

router.get("/rentals/reviews", async (_req, res) => {
  const rows = await db.select().from(reviewRequestsTable)
    .where(eq(reviewRequestsTable.estatus, "pendiente"));
  res.json(rows);
});

router.patch("/rentals/reviews/:id", async (req, res) => {
  // Accept either {accion: 'aprobar'|'rechazar'} or {estatus: 'aprobado'|'rechazado'}
  const { accion, estatus: rawEstatus, notas, revisor } = req.body;
  const estatus = rawEstatus ?? (accion === "aprobar" ? "aprobado" : accion === "rechazar" ? "rechazado" : undefined);
  if (!estatus) { res.status(400).json({ error: "accion o estatus requerido" }); return; }
  const [row] = await db.update(reviewRequestsTable)
    .set({ estatus, notas, revisor, resolved_at: new Date() })
    .where(eq(reviewRequestsTable.id, Number(req.params.id)))
    .returning();
  res.json(row);
});

router.patch("/rentals/:id/status", async (req, res) => {
  const { estatus } = req.body;
  const [rental] = await db.update(rentalsTable)
    .set({ estatus, updated_at: new Date() })
    .where(eq(rentalsTable.id, Number(req.params.id)))
    .returning();
  if (!rental) { res.status(404).json({ error: "No encontrado" }); return; }

  // Sync equipment status when rental lifecycle changes
  if (rental.equipo_serie) {
    const equipStatus =
      estatus === "en_renta"   ? "rentado"    :
      estatus === "pagado"     ? "rentado"    :
      estatus === "completado" ? "disponible" :
      estatus === "cancelado"  ? "disponible" : undefined;
    if (equipStatus) {
      await db.update(equipmentTable).set({ status: equipStatus as any })
        .where(eq(equipmentTable.serie, rental.equipo_serie));
    }
  }
  res.json(rental);
});

export default router;
