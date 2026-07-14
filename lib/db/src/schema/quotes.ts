import {
  pgTable, serial, text, boolean, integer, doublePrecision,
  timestamp, pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tipoPvEnum = pgEnum("tipo_persona", ["FISICA", "MORAL"]);
export const estatusCotEnum = pgEnum("estatus_cotizacion", [
  "BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA", "EXPIRADA"
]);

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  folio: text("folio").notNull().unique(),
  codigo_postal: text("codigo_postal").notNull(),
  zona: text("zona").notNull(),
  modelo: text("modelo").notNull(),
  serie: text("serie"),
  dias_renta: integer("dias_renta").notNull(),
  tipo_persona: tipoPvEnum("tipo_persona").notNull(),
  nombre_empresa: text("nombre_empresa"),
  rfc: text("rfc"),
  nombre_contacto: text("nombre_contacto"),
  telefono: text("telefono"),
  email: text("email"),
  direccion_entrega: text("direccion_entrega"),
  notas: text("notas"),
  costo_flete: doublePrecision("costo_flete").notNull(),
  costo_renta_diaria: doublePrecision("costo_renta_diaria").notNull(),
  subtotal: doublePrecision("subtotal").notNull(),
  iva: doublePrecision("iva").notNull(),
  monto_total: doublePrecision("monto_total").notNull(),
  estatus: estatusCotEnum("estatus").notNull().default("BORRADOR"),
  identidad_verificada: boolean("identidad_verificada").notNull().default(false),
  validacion_resultado: text("validacion_resultado"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  vigencia: timestamp("vigencia").notNull(),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({ id: true, created_at: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;
