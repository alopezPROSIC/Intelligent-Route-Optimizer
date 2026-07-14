import { Router } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/clients", async (req, res) => {
  const { search } = req.query;
  let query = db.select().from(clientsTable);
  if (search) {
    const results = await db.select().from(clientsTable)
      .where(or(ilike(clientsTable.cliente, `%${search}%`), ilike(clientsTable.obra, `%${search}%`)));
    res.json(results);
    return;
  }
  res.json(await query);
});

router.post("/clients", async (req, res) => {
  const [client] = await db.insert(clientsTable).values(req.body).returning();
  res.status(201).json(client);
});

router.get("/clients/:id", async (req, res) => {
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, Number(req.params.id)));
  if (!client) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(client);
});

router.put("/clients/:id", async (req, res) => {
  const [client] = await db.update(clientsTable).set(req.body).where(eq(clientsTable.id, Number(req.params.id))).returning();
  if (!client) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(client);
});

router.delete("/clients/:id", async (req, res) => {
  await db.delete(clientsTable).where(eq(clientsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
