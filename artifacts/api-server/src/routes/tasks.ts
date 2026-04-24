import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, tasksTable, usersTable, clientsTable, notificationsTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  ListTasksQueryParams,
  GetTaskParams,
  UpdateTaskParams,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { serializeTask } from "../lib/serializers";

const router: IRouter = Router();

async function loadJoinNames(rows: { assigneeId: number | null; clientId: number | null }[]) {
  const userIds = Array.from(
    new Set(rows.map((r) => r.assigneeId).filter((x): x is number => x !== null)),
  );
  const clientIds = Array.from(
    new Set(rows.map((r) => r.clientId).filter((x): x is number => x !== null)),
  );
  const users = userIds.length
    ? await db.select().from(usersTable).where(or(...userIds.map((id) => eq(usersTable.id, id)))!)
    : [];
  const clients = clientIds.length
    ? await db.select().from(clientsTable).where(or(...clientIds.map((id) => eq(clientsTable.id, id)))!)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  return { userMap, clientMap };
}

router.get("/tasks", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { assigneeId, clientId, status, priority, search } = parsed.data;
  const conds = [];
  if (assigneeId !== undefined) conds.push(eq(tasksTable.assigneeId, assigneeId));
  if (clientId !== undefined) conds.push(eq(tasksTable.clientId, clientId));
  if (status) conds.push(eq(tasksTable.status, status));
  if (priority) conds.push(eq(tasksTable.priority, priority));
  if (search) conds.push(ilike(tasksTable.title, `%${search}%`));
  const where = conds.length > 0 ? and(...conds) : undefined;
  const rows = await db.select().from(tasksTable).where(where).orderBy(desc(tasksTable.createdAt));
  const { userMap, clientMap } = await loadJoinNames(rows);
  res.json(
    rows.map((t) =>
      serializeTask(t, {
        assigneeName: t.assigneeId ? userMap.get(t.assigneeId) ?? null : null,
        clientName: t.clientId ? clientMap.get(t.clientId) ?? null : null,
      }),
    ),
  );
});

router.post("/tasks", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
    return;
  }
  const data = parsed.data;
  const inserted = await db
    .insert(tasksTable)
    .values({
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId ?? null,
      clientId: data.clientId ?? null,
      dueDate: data.dueDate ? data.dueDate.toISOString().slice(0, 10) : null,
      createdById: req.user!.id,
      completedAt: data.status === "done" ? new Date() : null,
    })
    .returning();
  const task = inserted[0]!;
  // notify assignee
  if (task.assigneeId && task.assigneeId !== req.user!.id) {
    await db.insert(notificationsTable).values({
      userId: task.assigneeId,
      title: "New task assigned",
      message: `${req.user!.name} assigned you "${task.title}"`,
      type: "task",
      link: `/tasks`,
    });
  }
  const { userMap, clientMap } = await loadJoinNames([task]);
  res.status(201).json(
    serializeTask(task, {
      assigneeName: task.assigneeId ? userMap.get(task.assigneeId) ?? null : null,
      clientName: task.clientId ? clientMap.get(task.clientId) ?? null : null,
    }),
  );
});

router.get("/tasks/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = GetTaskParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db.select().from(tasksTable).where(eq(tasksTable.id, parsed.data.id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const task = rows[0]!;
  const { userMap, clientMap } = await loadJoinNames([task]);
  res.json(
    serializeTask(task, {
      assigneeName: task.assigneeId ? userMap.get(task.assigneeId) ?? null : null,
      clientName: task.clientId ? clientMap.get(task.clientId) ?? null : null,
    }),
  );
});

router.patch("/tasks/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const paramsParsed = UpdateTaskParams.safeParse(req.params);
  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = bodyParsed.data;
  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.status !== undefined) {
    update.status = data.status;
    update.completedAt = data.status === "done" ? new Date() : null;
  }
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.assigneeId !== undefined) update.assigneeId = data.assigneeId;
  if (data.clientId !== undefined) update.clientId = data.clientId;
  if (data.dueDate !== undefined) {
    update.dueDate = data.dueDate ? data.dueDate.toISOString().slice(0, 10) : null;
  }
  const updated = await db
    .update(tasksTable)
    .set(update)
    .where(eq(tasksTable.id, paramsParsed.data.id))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const task = updated[0]!;
  const { userMap, clientMap } = await loadJoinNames([task]);
  res.json(
    serializeTask(task, {
      assigneeName: task.assigneeId ? userMap.get(task.assigneeId) ?? null : null,
      clientName: task.clientId ? clientMap.get(task.clientId) ?? null : null,
    }),
  );
});

router.delete("/tasks/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = DeleteTaskParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
