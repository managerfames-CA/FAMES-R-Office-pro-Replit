import { pgTable, serial, text, timestamp, varchar, integer, date, numeric } from "drizzle-orm/pg-core";

export const workLogsTable = pgTable("work_logs", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  taskId: integer("task_id"),
  date: date("date").notNull(),
  summary: text("summary").notNull(),
  hours: numeric("hours", { precision: 6, scale: 2 }),
  status: varchar("status", { length: 32 }).notNull().default("in_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WorkLogRow = typeof workLogsTable.$inferSelect;
export type NewWorkLogRow = typeof workLogsTable.$inferInsert;
