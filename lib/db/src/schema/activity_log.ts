import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityTipoEnum = pgEnum("activity_tipo", ["SERVICIO", "COTIZACION", "SYNC", "ALERTA"]);

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  tipo: activityTipoEnum("tipo").notNull(),
  descripcion: text("descripcion").notNull(),
  usuario: text("usuario"),
  servicio_id: integer("servicio_id"),
  estatus: text("estatus"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activityLogTable).omit({ id: true, created_at: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;
