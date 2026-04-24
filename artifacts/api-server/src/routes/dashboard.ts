import { Router, type IRouter, type Response } from "express";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  clientsTable,
  tasksTable,
  invoicesTable,
  attendanceTable,
  workLogsTable,
  notificationsTable,
} from "@workspace/db";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { serializeTask } from "../lib/serializers";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req: AuthedRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const [activeStaffRows] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "active")),
  ]);

  const totalClientsRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(clientsTable)
    .where(ne(clientsTable.status, "inactive"));

  const openTasksRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(tasksTable)
    .where(ne(tasksTable.status, "done"));

  const overdueRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(tasksTable)
    .where(and(ne(tasksTable.status, "done"), lte(tasksTable.dueDate, today)));

  const dueTodayRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(tasksTable)
    .where(and(ne(tasksTable.status, "done"), eq(tasksTable.dueDate, today)));

  const pendingInvRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(and(ne(invoicesTable.status, "paid"), ne(invoicesTable.status, "cancelled")));

  const revenueRows = await db
    .select({ s: sql<string>`coalesce(sum(${invoicesTable.total}), 0)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "paid"), gte(invoicesTable.issueDate, monthStartStr)));

  const presentRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.date, today), eq(attendanceTable.status, "present")));

  const unreadRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.user!.id), eq(notificationsTable.read, false)));

  res.json({
    activeStaff: Number(activeStaffRows[0]?.c ?? 0),
    totalClients: Number(totalClientsRows[0]?.c ?? 0),
    openTasks: Number(openTasksRows[0]?.c ?? 0),
    overdueTasks: Number(overdueRows[0]?.c ?? 0),
    tasksDueToday: Number(dueTodayRows[0]?.c ?? 0),
    pendingInvoices: Number(pendingInvRows[0]?.c ?? 0),
    revenueThisMonth: Number(revenueRows[0]?.s ?? 0),
    presentToday: Number(presentRows[0]?.c ?? 0),
    unreadNotifications: Number(unreadRows[0]?.c ?? 0),
  });
});

router.get("/dashboard/activity", requireAuth, async (_req: AuthedRequest, res: Response) => {
  const recentTasks = await db
    .select()
    .from(tasksTable)
    .orderBy(desc(tasksTable.createdAt))
    .limit(8);
  const recentLogs = await db
    .select()
    .from(workLogsTable)
    .orderBy(desc(workLogsTable.createdAt))
    .limit(8);
  const recentInvoices = await db
    .select()
    .from(invoicesTable)
    .orderBy(desc(invoicesTable.createdAt))
    .limit(8);
  const recentClients = await db
    .select()
    .from(clientsTable)
    .orderBy(desc(clientsTable.createdAt))
    .limit(5);
  const userIds = Array.from(
    new Set([
      ...recentTasks.map((t) => t.assigneeId).filter((x): x is number => x !== null),
      ...recentLogs.map((w) => w.staffId),
    ]),
  );
  const users = userIds.length
    ? await db
        .select()
        .from(usersTable)
        .where(sql`${usersTable.id} in ${userIds.length === 1 ? sql`(${userIds[0]})` : sql`(${sql.join(userIds, sql`, `)})`}`)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const items: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    actorName: string | null;
    createdAt: string;
  }> = [];

  for (const t of recentTasks) {
    const isCompleted = t.status === "done" && t.completedAt;
    items.push({
      id: `task-${t.id}-${isCompleted ? "done" : "new"}`,
      type: isCompleted ? "task_completed" : "task_created",
      title: isCompleted ? "Task completed" : "Task created",
      message: t.title,
      actorName: t.assigneeId ? userMap.get(t.assigneeId) ?? null : null,
      createdAt: (isCompleted ? t.completedAt! : t.createdAt).toISOString(),
    });
  }
  for (const w of recentLogs) {
    items.push({
      id: `log-${w.id}`,
      type: "work_log",
      title: "Work update",
      message: w.summary.length > 100 ? w.summary.slice(0, 100) + "…" : w.summary,
      actorName: userMap.get(w.staffId) ?? null,
      createdAt: w.createdAt.toISOString(),
    });
  }
  for (const i of recentInvoices) {
    items.push({
      id: `inv-${i.id}`,
      type: i.status === "paid" ? "invoice_paid" : "invoice_created",
      title: i.status === "paid" ? "Invoice paid" : "Invoice created",
      message: `${i.invoiceNumber} — $${Number(i.total).toFixed(2)}`,
      actorName: null,
      createdAt: i.createdAt.toISOString(),
    });
  }
  for (const c of recentClients) {
    items.push({
      id: `client-${c.id}`,
      type: "client_added",
      title: "Client added",
      message: c.name,
      actorName: null,
      createdAt: c.createdAt.toISOString(),
    });
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(items.slice(0, 15));
});

router.get("/dashboard/upcoming-tasks", requireAuth, async (req: AuthedRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const future = in7.toISOString().slice(0, 10);
  const conds = [
    ne(tasksTable.status, "done"),
    gte(tasksTable.dueDate, today),
    lte(tasksTable.dueDate, future),
  ];
  if (req.user!.role !== "admin") {
    conds.push(eq(tasksTable.assigneeId, req.user!.id));
  }
  const rows = await db
    .select()
    .from(tasksTable)
    .where(and(...conds))
    .orderBy(asc(tasksTable.dueDate))
    .limit(10);
  const userIds = Array.from(
    new Set(rows.map((r) => r.assigneeId).filter((x): x is number => x !== null)),
  );
  const users = userIds.length
    ? await db
        .select()
        .from(usersTable)
        .where(sql`${usersTable.id} in ${userIds.length === 1 ? sql`(${userIds[0]})` : sql`(${sql.join(userIds, sql`, `)})`}`)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  res.json(
    rows.map((t) =>
      serializeTask(t, {
        assigneeName: t.assigneeId ? userMap.get(t.assigneeId) ?? null : null,
      }),
    ),
  );
});

export default router;
