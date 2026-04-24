import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { db, attendanceTable, usersTable } from "@workspace/db";
import {
  CheckInBody,
  CheckOutBody,
  ListAttendanceQueryParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAuth } from "../lib/auth";
import { serializeAttendance } from "../lib/serializers";

const router: IRouter = Router();

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get("/attendance", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { staffId, from, to } = parsed.data;
  const conds = [];
  if (req.user!.role !== "admin") {
    conds.push(eq(attendanceTable.staffId, req.user!.id));
  } else if (staffId !== undefined) {
    conds.push(eq(attendanceTable.staffId, staffId));
  }
  if (from) conds.push(gte(attendanceTable.date, from.toISOString().slice(0, 10)));
  if (to) conds.push(lte(attendanceTable.date, to.toISOString().slice(0, 10)));
  const where = conds.length > 0 ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(attendanceTable)
    .where(where)
    .orderBy(desc(attendanceTable.date));
  const userIds = Array.from(new Set(rows.map((r) => r.staffId)));
  const users = userIds.length
    ? await db.select().from(usersTable).where(or(...userIds.map((id) => eq(usersTable.id, id)))!)
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  res.json(
    rows.map((a) =>
      serializeAttendance(a, { staffName: userMap.get(a.staffId) ?? "Unknown" }),
    ),
  );
});

router.post("/attendance/check-in", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = CheckInBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const today = todayDateString();
  const existing = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.staffId, req.user!.id), eq(attendanceTable.date, today)))
    .limit(1);
  let row;
  if (existing.length > 0 && existing[0]!.checkIn) {
    row = existing[0]!;
  } else if (existing.length > 0) {
    const updated = await db
      .update(attendanceTable)
      .set({ checkIn: new Date(), notes: parsed.data.notes ?? existing[0]!.notes, status: "present" })
      .where(eq(attendanceTable.id, existing[0]!.id))
      .returning();
    row = updated[0]!;
  } else {
    const inserted = await db
      .insert(attendanceTable)
      .values({
        staffId: req.user!.id,
        date: today,
        checkIn: new Date(),
        status: "present",
        notes: parsed.data.notes ?? null,
      })
      .returning();
    row = inserted[0]!;
  }
  res.json(serializeAttendance(row, { staffName: req.user!.name }));
});

router.post("/attendance/check-out", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = CheckOutBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const today = todayDateString();
  const existing = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.staffId, req.user!.id), eq(attendanceTable.date, today)))
    .limit(1);
  if (existing.length === 0) {
    res.status(400).json({ error: "Check in first before checking out" });
    return;
  }
  const updated = await db
    .update(attendanceTable)
    .set({
      checkOut: new Date(),
      notes: parsed.data.notes ?? existing[0]!.notes,
    })
    .where(eq(attendanceTable.id, existing[0]!.id))
    .returning();
  res.json(serializeAttendance(updated[0]!, { staffName: req.user!.name }));
});

router.get("/attendance/today", requireAuth, async (req: AuthedRequest, res: Response) => {
  const today = todayDateString();
  const rows = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.staffId, req.user!.id), eq(attendanceTable.date, today)))
    .limit(1);
  if (rows.length === 0) {
    res.json(null);
    return;
  }
  res.json(serializeAttendance(rows[0]!, { staffName: req.user!.name }));
});

export default router;
