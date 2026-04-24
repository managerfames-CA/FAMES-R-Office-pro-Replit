import { Router, type IRouter, type Response } from "express";
import { and, asc, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db, workLogsTable, usersTable, tasksTable, type WorkLogRow } from "@workspace/db";
import {
  CreateWorkLogBody,
  UpdateWorkLogBody,
  ListWorkLogsQueryParams,
  UpdateWorkLogParams,
  DeleteWorkLogParams,
} from "@workspace/api-zod";

function parseReviewBody(body: unknown): { notes: string | null } {
  if (body && typeof body === "object" && "notes" in body) {
    const n = (body as { notes: unknown }).notes;
    if (typeof n === "string") return { notes: n.trim() === "" ? null : n.trim() };
  }
  return { notes: null };
}
import { type AuthedRequest, requireAdmin, requireAuth } from "../lib/auth";
import { serializeWorkLog } from "../lib/serializers";

const router: IRouter = Router();

async function hydrate(rows: WorkLogRow[]) {
  const userIds = new Set<number>();
  const taskIds = new Set<number>();
  rows.forEach((r) => {
    userIds.add(r.staffId);
    if (r.taskId) taskIds.add(r.taskId);
    if (r.reviewedBy) userIds.add(r.reviewedBy);
  });
  const userIdArr = Array.from(userIds);
  const taskIdArr = Array.from(taskIds);
  const users = userIdArr.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIdArr))
    : [];
  const tasks = taskIdArr.length
    ? await db.select().from(tasksTable).where(inArray(tasksTable.id, taskIdArr))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const taskMap = new Map(tasks.map((t) => [t.id, t.title]));
  return rows.map((w) =>
    serializeWorkLog(w, {
      staffName: userMap.get(w.staffId) ?? "Unknown",
      taskTitle: w.taskId ? taskMap.get(w.taskId) ?? null : null,
      reviewerName: w.reviewedBy ? userMap.get(w.reviewedBy) ?? null : null,
    }),
  );
}

router.get(
  "/work-logs/pending-approvals",
  requireAdmin,
  async (_req: AuthedRequest, res: Response) => {
    const rows = await db
      .select()
      .from(workLogsTable)
      .where(eq(workLogsTable.approvalStatus, "submitted"))
      .orderBy(asc(workLogsTable.createdAt));
    res.json(await hydrate(rows));
  },
);

router.get("/work-logs", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListWorkLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { staffId, taskId, from, to } = parsed.data;
  const conds = [];
  const isAdmin = req.user!.role === "admin";
  const canSeeTeamLogs = isAdmin || (req.user!.permissions ?? []).includes("view_team_work_logs");
  if (!canSeeTeamLogs) {
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
  res.json(await hydrate(rows));
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
      approvalStatus: data.submitForReview ? "submitted" : "draft",
    })
    .returning();
  const out = await hydrate([inserted[0]!]);
  res.status(201).json(out[0]);
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
  if (data.submitForReview === true) {
    update.approvalStatus = "submitted";
    update.reviewNotes = null;
    update.reviewedBy = null;
    update.reviewedAt = null;
  }
  const updated = await db
    .update(workLogsTable)
    .set(update)
    .where(eq(workLogsTable.id, paramsParsed.data.id))
    .returning();
  const out = await hydrate([updated[0]!]);
  res.json(out[0]);
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

router.post(
  "/work-logs/:id/approve",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { notes } = parseReviewBody(req.body);
    const updated = await db
      .update(workLogsTable)
      .set({
        approvalStatus: "approved",
        reviewNotes: notes,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(workLogsTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const out = await hydrate([updated[0]!]);
    res.json(out[0]);
  },
);

router.post(
  "/work-logs/:id/reject",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    const id = Number.parseInt(req.params.id ?? "", 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { notes } = parseReviewBody(req.body);
    const updated = await db
      .update(workLogsTable)
      .set({
        approvalStatus: "rejected",
        reviewNotes: notes,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(workLogsTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const out = await hydrate([updated[0]!]);
    res.json(out[0]);
  },
);

export default router;
