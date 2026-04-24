import { Router, type IRouter, type Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  tasksTable,
  invoicesTable,
  usersTable,
  workLogsTable,
  attendanceTable,
} from "@workspace/db";
import { type AuthedRequest, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/reports/task-status", requireAuth, async (_req: AuthedRequest, res: Response) => {
  const rows = await db
    .select({ status: tasksTable.status, count: sql<number>`count(*)` })
    .from(tasksTable)
    .groupBy(tasksTable.status);
  res.json(rows.map((r) => ({ status: r.status, count: Number(r.count) })));
});

router.get("/reports/revenue", requireAuth, async (_req: AuthedRequest, res: Response) => {
  // Last 6 months including current
  const now = new Date();
  const months: { key: string; label: string; start: string; end: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    months.push({
      key,
      label,
      start: d.toISOString().slice(0, 10),
      end: next.toISOString().slice(0, 10),
    });
  }
  const earliest = months[0]!.start;
  const all = await db
    .select()
    .from(invoicesTable)
    .where(gte(invoicesTable.issueDate, earliest));
  const result = months.map((m) => {
    let revenue = 0;
    let invoiced = 0;
    for (const inv of all) {
      const issue = typeof inv.issueDate === "string" ? inv.issueDate : (inv.issueDate as unknown as Date).toISOString().slice(0, 10);
      if (issue >= m.start && issue < m.end) {
        invoiced += Number(inv.total);
        if (inv.status === "paid") revenue += Number(inv.total);
      }
    }
    return { month: m.label, revenue, invoiced };
  });
  res.json(result);
});

router.get("/reports/staff-performance", requireAuth, async (_req: AuthedRequest, res: Response) => {
  const staff = await db.select().from(usersTable).where(eq(usersTable.status, "active"));
  const completed = await db
    .select({ assigneeId: tasksTable.assigneeId, c: sql<number>`count(*)` })
    .from(tasksTable)
    .where(eq(tasksTable.status, "done"))
    .groupBy(tasksTable.assigneeId);
  const inProgress = await db
    .select({ assigneeId: tasksTable.assigneeId, c: sql<number>`count(*)` })
    .from(tasksTable)
    .where(eq(tasksTable.status, "in_progress"))
    .groupBy(tasksTable.assigneeId);
  const hours = await db
    .select({
      staffId: workLogsTable.staffId,
      h: sql<string>`coalesce(sum(${workLogsTable.hours}), 0)`,
    })
    .from(workLogsTable)
    .groupBy(workLogsTable.staffId);
  const completedMap = new Map(completed.map((r) => [r.assigneeId, Number(r.c)]));
  const inProgressMap = new Map(inProgress.map((r) => [r.assigneeId, Number(r.c)]));
  const hoursMap = new Map(hours.map((r) => [r.staffId, Number(r.h)]));
  res.json(
    staff
      .map((s) => ({
        staffId: s.id,
        staffName: s.name,
        tasksCompleted: completedMap.get(s.id) ?? 0,
        tasksInProgress: inProgressMap.get(s.id) ?? 0,
        hoursLogged: hoursMap.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted),
  );
});

router.get("/reports/attendance-summary", requireAuth, async (_req: AuthedRequest, res: Response) => {
  const days: { date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10) });
  }
  const earliest = days[0]!.date;
  const rows = await db
    .select()
    .from(attendanceTable)
    .where(gte(attendanceTable.date, earliest));
  const totalStaffRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.status, "active"));
  const totalStaff = Number(totalStaffRows[0]?.c ?? 0);
  const result = days.map((d) => {
    let present = 0,
      late = 0;
    for (const a of rows) {
      const date = typeof a.date === "string" ? a.date : (a.date as unknown as Date).toISOString().slice(0, 10);
      if (date === d.date) {
        if (a.status === "present") present++;
        else if (a.status === "late") late++;
      }
    }
    const accountedFor = present + late;
    const absent = Math.max(0, totalStaff - accountedFor);
    return { date: d.date, present, absent, late };
  });
  res.json(result);
});

export default router;
