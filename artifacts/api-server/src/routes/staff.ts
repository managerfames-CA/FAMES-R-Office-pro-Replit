import { Router, type IRouter, type Response } from "express";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateStaffBody,
  UpdateStaffBody,
  ListStaffQueryParams,
  GetStaffParams,
  UpdateStaffParams,
  DeleteStaffParams,
} from "@workspace/api-zod";
import { type AuthedRequest, hashPassword, requireAdmin, requireAuth } from "../lib/auth";
import { serializeStaff } from "../lib/serializers";

const router: IRouter = Router();

router.get("/staff", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListStaffQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { search, status } = parsed.data;
  const conds = [];
  if (status) conds.push(eq(usersTable.status, status));
  if (search) {
    const like = `%${search}%`;
    conds.push(or(ilike(usersTable.name, like), ilike(usersTable.email, like))!);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(usersTable)
    .where(where)
    .orderBy(asc(usersTable.name));
  res.json(rows.map(serializeStaff));
});

router.post("/staff", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
    return;
  }
  const data = parsed.data;
  const passwordHash = hashPassword(data.password);
  const inserted = await db
    .insert(usersTable)
    .values({
      email: data.email.toLowerCase().trim(),
      name: data.name,
      role: data.role,
      passwordHash,
      position: data.position ?? null,
      phone: data.phone ?? null,
      department: data.department ?? null,
      joinedAt: data.joinedAt ? data.joinedAt.toISOString().slice(0, 10) : null,
    })
    .returning();
  res.status(201).json(serializeStaff(inserted[0]!));
});

router.get("/staff/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = GetStaffParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeStaff(rows[0]!));
});

router.patch("/staff/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const paramsParsed = UpdateStaffParams.safeParse(req.params);
  const bodyParsed = UpdateStaffBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const targetId = paramsParsed.data.id;
  const isSelf = req.user!.id === targetId;
  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && !isSelf) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const data = bodyParsed.data;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.position !== undefined) update.position = data.position;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.department !== undefined) update.department = data.department;
  if (data.password) update.passwordHash = hashPassword(data.password);
  if (isAdmin) {
    if (data.role !== undefined) update.role = data.role;
    if (data.status !== undefined) update.status = data.status;
  }
  const updated = await db
    .update(usersTable)
    .set(update)
    .where(eq(usersTable.id, targetId))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeStaff(updated[0]!));
});

router.delete("/staff/:id", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = DeleteStaffParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (parsed.data.id === req.user!.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
