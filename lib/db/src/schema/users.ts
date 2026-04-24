import { boolean, pgTable, serial, text, timestamp, varchar, date } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("staff"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  position: varchar("position", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  department: varchar("department", { length: 255 }),
  avatarUrl: text("avatar_url"),
  joinedAt: date("joined_at"),
  permissions: text("permissions").array().notNull().default([]),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserRow = typeof usersTable.$inferSelect;
export type NewUserRow = typeof usersTable.$inferInsert;

export const PERMISSION_KEYS = [
  "view_reports",
  "view_invoices",
  "manage_invoices",
  "manage_clients",
  "view_team_attendance",
  "view_team_work_logs",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
