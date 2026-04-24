import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { db, workLogsTable, usersTable, tasksTable } from "@workspace/db";
import {
  CreateWorkLogBody,
  UpdateWorkLogBody,
  ListWorkLogsQueryParams,
  UpdateWorkLogParams,
  DeleteWorkLogParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { serializeWorkLog } from "../lib/serializers";

const router: IRouter = Router();

router.get("/work-logs", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListWorkLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { staffId, taskId, from, to } = parsed.data;
  const conds = [];
  if (req.user!.role !== "admin") {
    conds.push(eq(workLogsTable.staffId, req.user!.id));
  } else if (staffId !== undefined) {
    conds.push(eq(workLogsTable.staffId, staffId));
  }
  if (taskId !== undefined) conds.push(eq(workLogsTable.taskId, taskId));
  if (from) conds.push(gte(workLogsTable.date, from.toISOString().slice(0, 10)));
  if (to) conds.push(lte(workLogsTable.date, to.toISOString().slice(0, 10)));
  const where = conds.length > 0 ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(workLogsTable)
    .where(where)
    .orderBy(desc(workLogsTable.date), desc(workLogsTable.createdAt));
  const userIds = Array.from(new Set(rows.map((r) => r.staffId)));
  const taskIds = Array.from(
    new Set(rows.map((r) => r.taskId).filter((x): x is number => x !== null)),
  );
  const users = userIds.length
    ? await db.select().from(usersTable).where(or(...userIds.map((id) => eq(usersTable.id, id)))!)
    : [];
  const tasks = taskIds.length
    ? await db.select().from(tasksTable).where(or(...taskIds.map((id) => eq(tasksTable.id, id)))!)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const taskMap = new Map(tasks.map((t) => [t.id, t.title]));
  res.json(
    rows.map((w) =>
      serializeWorkLog(w, {
        staffName: userMap.get(w.staffId) ?? "Unknown",
        taskTitle: w.taskId ? taskMap.get(w.taskId) ?? null : null,
      }),
    ),
  );
});

router.post("/work-logs", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = CreateWorkLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
    return;
  }
  const data = parsed.data;
  const inserted = await db
    .insert(workLogsTable)
    .values({
      staffId: req.user!.id,
      taskId: data.taskId ?? null,
      date: data.date.toISOString().slice(0, 10),
      summary: data.summary,
      hours: data.hours == null ? null : String(data.hours),
      status: data.status,
    })
    .returning();
  const w = inserted[0]!;
  let taskTitle: string | null = null;
  if (w.taskId) {
    const t = await db.select().from(tasksTable).where(eq(tasksTable.id, w.taskId)).limit(1);
    taskTitle = t[0]?.title ?? null;
  }
  res.status(201).json(serializeWorkLog(w, { staffName: req.user!.name, taskTitle }));
});

router.patch("/work-logs/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const paramsParsed = UpdateWorkLogParams.safeParse(req.params);
  const bodyParsed = UpdateWorkLogBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existing = await db
    .select()
    .from(workLogsTable)
    .where(eq(workLogsTable.id, paramsParsed.data.id))
    .limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing[0]!.staffId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const data = bodyParsed.data;
  const update: Record<string, unknown> = {};
  if (data.taskId !== undefined) update.taskId = data.taskId;
  if (data.date !== undefined) update.date = data.date.toISOString().slice(0, 10);
  if (data.summary !== undefined) update.summary = data.summary;
  if (data.hours !== undefined) update.hours = data.hours == null ? null : String(data.hours);
  if (data.status !== undefined) update.status = data.status;
  const updated = await db
    .update(workLogsTable)
    .set(update)
    .where(eq(workLogsTable.id, paramsParsed.data.id))
    .returning();
  const w = updated[0]!;
  let taskTitle: string | null = null;
  if (w.taskId) {
    const t = await db.select().from(tasksTable).where(eq(tasksTable.id, w.taskId)).limit(1);
    taskTitle = t[0]?.title ?? null;
  }
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, w.staffId)).limit(1);
  res.json(
    serializeWorkLog(w, {
      staffName: userRows[0]?.name ?? "Unknown",
      taskTitle,
    }),
  );
});

router.delete("/work-logs/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = DeleteWorkLogParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await db
    .select()
    .from(workLogsTable)
    .where(eq(workLogsTable.id, parsed.data.id))
    .limit(1);
  if (existing.length === 0) {
    res.status(204).end();
    return;
  }
  if (existing[0]!.staffId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(workLogsTable).where(eq(workLogsTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
