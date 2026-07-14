import { pgTable, serial, text, doublePrecision, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  placa: text("placa").notNull().unique(),
  capacidad: doublePrecision("capacidad").notNull(),
  ubicacion: text("ubicacion"),
  conductor_asignado: text("conductor_asignado"),
  tipo_vehiculo: text("tipo_vehiculo").notNull(),
  disponible: boolean("disponible").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, created_at: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
