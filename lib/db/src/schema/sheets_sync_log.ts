import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const sheetsSyncLogTable = pgTable("sheets_sync_log", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull(),           // import | export | bidirectional
  hoja: text("hoja"),                               // sheet tab name
  registros_importados: integer("registros_importados").notNull().default(0),
  registros_exportados: integer("registros_exportados").notNull().default(0),
  errores: jsonb("errores").$type<string[]>().default([]),
  usuario: text("usuario"),
  estatus: text("estatus").notNull().default("ok"), // ok | error | partial
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type SheetsSyncLog = typeof sheetsSyncLogTable.$inferSelect;
