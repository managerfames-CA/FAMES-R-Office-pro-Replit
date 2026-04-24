import { pgTable, serial, text, timestamp, varchar, integer, date } from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("todo"),
  priority: varchar("priority", { length: 32 }).notNull().default("medium"),
  assigneeId: integer("assignee_id"),
  clientId: integer("client_id"),
  dueDate: date("due_date"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type TaskRow = typeof tasksTable.$inferSelect;
export type NewTaskRow = typeof tasksTable.$inferInsert;
