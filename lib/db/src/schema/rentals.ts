import { pgTable, serial, text, integer, numeric, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentalsTable = pgTable("rentals", {
  id: serial("id").primaryKey(),
  folio: text("folio").notNull().unique(),
  equipo_id_equipo: text("equipo_id_equipo").notNull(),
  equipo_modelo: text("equipo_modelo").notNull(),
  equipo_serie: text("equipo_serie"),
  cliente_nombre: text("cliente_nombre").notNull(),
  cliente_tipo: text("cliente_tipo").notNull().default("FISICA"),
  cliente_razon_social: text("cliente_razon_social"),
  cliente_rfc: text("cliente_rfc"),
  cliente_curp: text("cliente_curp"),
  cliente_email: text("cliente_email").notNull(),
  cliente_telefono: text("cliente_telefono").notNull(),
  direccion_entrega: text("direccion_entrega").notNull(),
  codigo_postal: text("codigo_postal"),
  dias_renta: integer("dias_renta").notNull().default(1),
  costo_renta: numeric("costo_renta", { precision: 12, scale: 2 }).notNull().default("0"),
  costo_flete: numeric("costo_flete", { precision: 12, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  iva: numeric("iva", { precision: 12, scale: 2 }).notNull().default("0"),
  monto_total: numeric("monto_total", { precision: 12, scale: 2 }).notNull().default("0"),
  identity_score: integer("identity_score").notNull().default(0),
  requires_review: boolean("requires_review").notNull().default(false),
  estatus: text("estatus").notNull().default("pendiente_pago"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  stripe_client_secret: text("stripe_client_secret"),
  fecha_inicio: date("fecha_inicio"),
  fecha_fin: date("fecha_fin"),
  notas: text("notas"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const reviewRequestsTable = pgTable("review_requests", {
  id: serial("id").primaryKey(),
  rental_id: integer("rental_id").references(() => rentalsTable.id),
  tipo: text("tipo").notNull().default("identity_review"),
  datos_json: text("datos_json"),
  estatus: text("estatus").notNull().default("pendiente"),
  revisor: text("revisor"),
  notas: text("notas"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  resolved_at: timestamp("resolved_at"),
});

export const insertRentalSchema = createInsertSchema(rentalsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentalsTable.$inferSelect;
export type ReviewRequest = typeof reviewRequestsTable.$inferSelect;
