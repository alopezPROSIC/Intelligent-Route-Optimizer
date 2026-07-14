import { Request, Response, NextFunction } from "express";
import { getSessionUserId } from "../lib/auth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const userId = getSessionUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Sesión inválida o expirada" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }

  (req as any).user = user;
  next();
}
