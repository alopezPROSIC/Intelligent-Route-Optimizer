import { Router } from "express";
import { db, vehiclesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/vehicles", async (req, res) => {
  res.json(await db.select().from(vehiclesTable));
});

router.post("/vehicles", async (req, res) => {
  const [v] = await db.insert(vehiclesTable).values(req.body).returning();
  res.status(201).json(v);
});

router.put("/vehicles/:id", async (req, res) => {
  const [v] = await db.update(vehiclesTable).set(req.body).where(eq(vehiclesTable.id, Number(req.params.id))).returning();
  if (!v) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(v);
});

router.delete("/vehicles/:id", async (req, res) => {
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
