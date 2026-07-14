import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  cliente: text("cliente").notNull(),
  obra: text("obra").notNull(),
  comentarios_operaciones: text("comentarios_operaciones"),
  calificacion: text("calificacion"),
  sector_alimenticio: boolean("sector_alimenticio").notNull().default(false),
  sector_automotriz: boolean("sector_automotriz").notNull().default(false),
  sector_construccion: boolean("sector_construccion").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, created_at: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
