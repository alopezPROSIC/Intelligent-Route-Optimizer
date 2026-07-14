import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rolEnum = pgEnum("rol", ["OPERACIONES", "TRAFICO", "VENDEDOR", "GERENCIA", "ADMIN"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  nombre: text("nombre").notNull(),
  rol: rolEnum("rol").notNull().default("OPERACIONES"),
  sucursal: text("sucursal"),
  activo: text("activo").notNull().default("true"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
