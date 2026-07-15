import { pgTable, serial, text, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  session_id: text("session_id"),                 // stripe checkout session id (if used)
  payment_intent_id: text("payment_intent_id"),   // stripe payment intent id
  provider: text("provider").notNull().default("stripe"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("mxn"),
  status: text("status").notNull().default("initiated"),         // initiated | pending | succeeded | failed | expired
  payment_status: text("payment_status").notNull().default("unpaid"),
  rental_id: integer("rental_id"),
  quote_id: integer("quote_id"),
  cliente_email: text("cliente_email"),
  metadata: jsonb("metadata").$type<Record<string, string>>().default({}),
  processed: integer("processed").notNull().default(0),          // 0/1 idempotency flag
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
