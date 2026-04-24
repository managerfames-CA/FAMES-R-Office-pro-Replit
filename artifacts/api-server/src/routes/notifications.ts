import { Router, type IRouter, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { ListNotificationsQueryParams, MarkNotificationReadParams } from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { serializeNotification } from "../lib/serializers";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListNotificationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const conds = [eq(notificationsTable.userId, req.user!.id)];
  if (parsed.data.unreadOnly) conds.push(eq(notificationsTable.read, false));
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(...conds))
    .orderBy(desc(notificationsTable.createdAt));
  res.json(rows.map(serializeNotification));
});

router.post("/notifications/:id/read", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = MarkNotificationReadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const updated = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, parsed.data.id), eq(notificationsTable.userId, req.user!.id)))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeNotification(updated[0]!));
});

router.post("/notifications/read-all", requireAuth, async (req: AuthedRequest, res: Response) => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, req.user!.id));
  res.status(204).end();
});

export default router;
