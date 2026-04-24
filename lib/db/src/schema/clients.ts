import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  notes: text("notes"),
  contactPerson: varchar("contact_person", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ClientRow = typeof clientsTable.$inferSelect;
export type NewClientRow = typeof clientsTable.$inferInsert;
