import { Router } from "express";
import { db, branchesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/branches", async (req, res) => {
  res.json(await db.select().from(branchesTable));
});

router.post("/branches", async (req, res) => {
  const [b] = await db.insert(branchesTable).values(req.body).returning();
  res.status(201).json(b);
});

export default router;
