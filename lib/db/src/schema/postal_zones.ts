import { pgTable, serial, text, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postalZonesTable = pgTable("postal_zones", {
  id: serial("id").primaryKey(),
  codigo_postal: text("codigo_postal").notNull().unique(),
  municipio: text("municipio").notNull(),
  estado: text("estado").notNull(),
  zona: text("zona").notNull(),
  tarifa_flete: doublePrecision("tarifa_flete").notNull(),
  tiempo_estimado_hrs: doublePrecision("tiempo_estimado_hrs").notNull().default(2),
});

export const insertPostalZoneSchema = createInsertSchema(postalZonesTable).omit({ id: true });
export type InsertPostalZone = z.infer<typeof insertPostalZoneSchema>;
export type PostalZone = typeof postalZonesTable.$inferSelect;
