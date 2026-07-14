import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession, destroySession, verifyPassword } from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email y contraseña requeridos" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const token = createSession(user.id);
  res.json({
    user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, sucursal: user.sucursal },
    token,
  });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) destroySession(token);
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth as any, async (req, res) => {
  const user = (req as any).user;
  res.json({ id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, sucursal: user.sucursal });
});

export default router;
