import { pgTable, serial, text, timestamp, varchar, integer, date } from "drizzle-orm/pg-core";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  date: date("date").notNull(),
  checkIn: timestamp("check_in", { withTimezone: true }),
  checkOut: timestamp("check_out", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull().default("present"),
  notes: text("notes"),
});

export type AttendanceRow = typeof attendanceTable.$inferSelect;
export type NewAttendanceRow = typeof attendanceTable.$inferInsert;
