import { Router } from "express";
import { db, driversTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/drivers", async (req, res) => {
  const { tipo } = req.query;
  if (tipo) {
    res.json(await db.select().from(driversTable).where(eq(driversTable.tipo, tipo as "PROPIO" | "EXTERNO")));
    return;
  }
  res.json(await db.select().from(driversTable));
});

router.post("/drivers", async (req, res) => {
  const body = { ...req.body, id_conductor: `DRV-${Date.now()}` };
  const [d] = await db.insert(driversTable).values(body).returning();
  res.status(201).json(d);
});

router.put("/drivers/:id", async (req, res) => {
  const [d] = await db.update(driversTable).set(req.body).where(eq(driversTable.id, Number(req.params.id))).returning();
  if (!d) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(d);
});

router.delete("/drivers/:id", async (req, res) => {
  await db.delete(driversTable).where(eq(driversTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
