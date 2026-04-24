import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientBody,
  ListClientsQueryParams,
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAdmin, requireAuth } from "../lib/auth";
import { serializeClient } from "../lib/serializers";

const router: IRouter = Router();

router.get("/clients", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListClientsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { search, status } = parsed.data;
  const conds = [];
  if (status) conds.push(eq(clientsTable.status, status));
  if (search) {
    const like = `%${search}%`;
    conds.push(
      or(
        ilike(clientsTable.name, like),
        ilike(clientsTable.company, like),
        ilike(clientsTable.email, like),
      )!,
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(clientsTable)
    .where(where)
    .orderBy(desc(clientsTable.createdAt));
  res.json(rows.map(serializeClient));
});

router.post("/clients", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
    return;
  }
  const inserted = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json(serializeClient(inserted[0]!));
});

router.get("/clients/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = GetClientParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, parsed.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeClient(rows[0]!));
});

router.patch("/clients/:id", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const paramsParsed = UpdateClientParams.safeParse(req.params);
  const bodyParsed = UpdateClientBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const updated = await db
    .update(clientsTable)
    .set(bodyParsed.data)
    .where(eq(clientsTable.id, paramsParsed.data.id))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeClient(updated[0]!));
});

router.delete("/clients/:id", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = DeleteClientParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(clientsTable).where(eq(clientsTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
