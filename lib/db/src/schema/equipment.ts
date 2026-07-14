import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const equipmentTable = pgTable("equipment", {
  id: serial("id").primaryKey(),
  id_equipo: text("id_equipo").notNull().unique(),
  modelo: text("modelo").notNull(),
  serie: text("serie").notNull().unique(),
  tipo: text("tipo"),
  disponible: boolean("disponible").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertEquipmentSchema = createInsertSchema(equipmentTable).omit({ id: true, created_at: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipmentTable.$inferSelect;
