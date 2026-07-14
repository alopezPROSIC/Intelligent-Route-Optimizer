import { Router } from "express";
import { db, equipmentTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/equipment", async (req, res) => {
  const { tipo } = req.query;
  if (tipo) {
    res.json(await db.select().from(equipmentTable).where(ilike(equipmentTable.tipo, String(tipo))));
    return;
  }
  res.json(await db.select().from(equipmentTable));
});

router.post("/equipment", async (req, res) => {
  const body = { ...req.body, id_equipo: `EQ-${Date.now()}` };
  const [eq_] = await db.insert(equipmentTable).values(body).returning();
  res.status(201).json(eq_);
});

router.put("/equipment/:id", async (req, res) => {
  const [eq_] = await db.update(equipmentTable).set(req.body).where(eq(equipmentTable.id, Number(req.params.id))).returning();
  if (!eq_) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(eq_);
});

router.delete("/equipment/:id", async (req, res) => {
  await db.delete(equipmentTable).where(eq(equipmentTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
