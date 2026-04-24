import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const firmProfileTable = pgTable("firm_profile", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  tagline: varchar("tagline", { length: 255 }),
  logoUrl: text("logo_url"),
  address: text("address"),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type FirmProfileRow = typeof firmProfileTable.$inferSelect;
export type NewFirmProfileRow = typeof firmProfileTable.$inferInsert;
