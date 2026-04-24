import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, firmProfileTable, type FirmProfileRow } from "@workspace/db";
import { UpdateFirmProfileBody } from "@workspace/api-zod";
import { type AuthedRequest, requireAdmin, requireAuth } from "../lib/auth";

const router: IRouter = Router();

function serialize(row: FirmProfileRow) {
  return {
    name: row.name,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    address: row.address,
    phone: row.phone,
    email: row.email,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureProfile(): Promise<FirmProfileRow> {
  const rows = await db.select().from(firmProfileTable).limit(1);
  if (rows.length > 0) return rows[0]!;
  const inserted = await db.insert(firmProfileTable).values({}).returning();
  return inserted[0]!;
}

router.get("/firm-profile", requireAuth, async (_req: AuthedRequest, res: Response) => {
  const row = await ensureProfile();
  res.json(serialize(row));
});

router.patch("/firm-profile", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = UpdateFirmProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
    return;
  }
  const data = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name?.trim() || null;
  if (data.tagline !== undefined) update.tagline = data.tagline?.trim() || null;
  if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl?.trim() || null;
  if (data.address !== undefined) update.address = data.address?.trim() || null;
  if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
  if (data.email !== undefined) update.email = data.email?.trim() || null;

  const existing = await ensureProfile();
  const updated = await db
    .update(firmProfileTable)
    .set(update)
    .where(eq(firmProfileTable.id, existing.id))
    .returning();
  res.json(serialize(updated[0]!));
});

export default router;
