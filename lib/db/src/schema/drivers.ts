import { pgTable, serial, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tipoTransporteEnum = pgEnum("tipo_transporte", ["PROPIO", "EXTERNO"]);

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  id_conductor: text("id_conductor").notNull().unique(),
  nombre: text("nombre").notNull(),
  tipo: tipoTransporteEnum("tipo").notNull(),
  activo: boolean("activo").notNull().default(true),
  servicios_mes: integer("servicios_mes").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertDriverSchema = createInsertSchema(driversTable).omit({ id: true, created_at: true });
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;
