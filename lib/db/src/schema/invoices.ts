import { pgTable, serial, text, timestamp, varchar, integer, date, numeric, jsonb } from "drizzle-orm/pg-core";

export type InvoiceItemJson = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  items: jsonb("items").$type<InvoiceItemJson[]>().notNull().default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InvoiceRow = typeof invoicesTable.$inferSelect;
export type NewInvoiceRow = typeof invoicesTable.$inferInsert;
