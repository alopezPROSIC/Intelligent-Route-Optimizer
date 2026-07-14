import { Router } from "express";
import { db, equipmentTable } from "@workspace/db";
import { ilike } from "drizzle-orm";

const router = Router();

// Public: list equipment for the storefront catalog (no auth required)
router.get("/equipment/catalog", async (req, res) => {
  const { tipo } = req.query;
  if (tipo) {
    res.json(await db.select().from(equipmentTable).where(ilike(equipmentTable.tipo, `%${String(tipo)}%`)));
    return;
  }
  res.json(await db.select().from(equipmentTable));
});

export default router;
