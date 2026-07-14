import {
  pgTable, serial, text, boolean, integer, doublePrecision,
  timestamp, pgEnum, date
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const operacionEnum = pgEnum("operacion", ["E", "R", "CF", "RU"]);
export const estatusEnum = pgEnum("estatus_servicio", [
  "PENDIENTE", "PROGRAMADO", "EN_TRANSITO", "ENTREGADO", "CANCELADO", "TERMINADO"
]);
export const tipoServicioEnum = pgEnum("tipo_servicio", ["LOCAL", "FORANEO"]);

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  fecha_solicitud: date("fecha_solicitud"),
  fecha_programacion: date("fecha_programacion"),
  horario: text("horario"),
  fecha_facturacion: date("fecha_facturacion"),
  sucursal_salida: text("sucursal_salida"),
  sucursal_vendedor: text("sucursal_vendedor"),
  vendedor: text("vendedor"),
  operacion: operacionEnum("operacion").notNull(),
  pedido: text("pedido"),
  remision: text("remision"),
  cliente: text("cliente"),
  obra: text("obra"),
  direccion: text("direccion"),
  latitud: doublePrecision("latitud"),
  longitud: doublePrecision("longitud"),
  modelo: text("modelo"),
  serie: text("serie"),
  dias_renta: integer("dias_renta"),
  dias_pend_fact: integer("dias_pend_fact"),
  costo_remision: doublePrecision("costo_remision"),
  costo_tabulador: doublePrecision("costo_tabulador"),
  costo_flete_ext: doublePrecision("costo_flete_ext"),
  diferencia: doublePrecision("diferencia"),
  factura: text("factura"),
  fecha_entrega: date("fecha_entrega"),
  transporte: text("transporte"),
  conductor: text("conductor"),
  conductor_id: integer("conductor_id"),
  vehiculo_id: integer("vehiculo_id"),
  hora_programada: text("hora_programada"),
  hora_reprogramada: text("hora_reprogramada"),
  carta_porte: boolean("carta_porte").notNull().default(false),
  correo_programacion: boolean("correo_programacion").notNull().default(false),
  correo_confirmacion: boolean("correo_confirmacion").notNull().default(false),
  evidencia: boolean("evidencia").notNull().default(false),
  contacto_nombre: text("contacto_nombre"),
  contacto_telefono: text("contacto_telefono"),
  estatus: estatusEnum("estatus").notNull().default("PENDIENTE"),
  comentarios_op: text("comentarios_op"),
  comentarios_traf: text("comentarios_traf"),
  horas_retraso: doublePrecision("horas_retraso"),
  retraso_total: doublePrecision("retraso_total"),
  tipo_servicio: tipoServicioEnum("tipo_servicio"),
  kms_recorridos: doublePrecision("kms_recorridos"),
  dias_retraso: integer("dias_retraso"),
  es_retorno_base: boolean("es_retorno_base").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
