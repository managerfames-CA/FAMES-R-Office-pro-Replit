import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { db, invoicesTable, clientsTable, type InvoiceItemJson } from "@workspace/db";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  ListInvoicesQueryParams,
  GetInvoiceParams,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
} from "@workspace/api-zod";
import { type AuthedRequest, requireAdmin, requireAuth } from "../lib/auth";
import { serializeInvoice } from "../lib/serializers";

const router: IRouter = Router();

function computeTotals(items: InvoiceItemJson[], tax: number) {
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  const total = subtotal + (tax || 0);
  return {
    subtotal: subtotal.toFixed(2),
    tax: (tax || 0).toFixed(2),
    total: total.toFixed(2),
  };
}

async function nextInvoiceNumber(): Promise<string> {
  const all = await db.select().from(invoicesTable);
  const year = new Date().getFullYear();
  const seq = all.length + 1;
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

async function loadClientNames(invs: { clientId: number }[]) {
  const ids = Array.from(new Set(invs.map((i) => i.clientId)));
  if (ids.length === 0) return new Map<number, string>();
  const rows = await db.select().from(clientsTable).where(or(...ids.map((id) => eq(clientsTable.id, id)))!);
  return new Map(rows.map((c) => [c.id, c.name]));
}

router.get("/invoices", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = ListInvoicesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { clientId, status } = parsed.data;
  const conds = [];
  if (clientId !== undefined) conds.push(eq(invoicesTable.clientId, clientId));
  if (status) conds.push(eq(invoicesTable.status, status));
  const where = conds.length > 0 ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(invoicesTable)
    .where(where)
    .orderBy(desc(invoicesTable.issueDate));
  const clientMap = await loadClientNames(rows);
  res.json(
    rows.map((i) =>
      serializeInvoice(i, { clientName: clientMap.get(i.clientId) ?? "Unknown" }),
    ),
  );
});

router.post("/invoices", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
    return;
  }
  const data = parsed.data;
  const items = data.items.map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
  }));
  const totals = computeTotals(items, Number(data.tax ?? 0));
  const invoiceNumber = await nextInvoiceNumber();
  const inserted = await db
    .insert(invoicesTable)
    .values({
      invoiceNumber,
      clientId: data.clientId,
      status: data.status,
      items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      issueDate: data.issueDate.toISOString().slice(0, 10),
      dueDate: data.dueDate ? data.dueDate.toISOString().slice(0, 10) : null,
      notes: data.notes ?? null,
      paidAt: data.status === "paid" ? new Date() : null,
    })
    .returning();
  const inv = inserted[0]!;
  const clientMap = await loadClientNames([inv]);
  res.status(201).json(
    serializeInvoice(inv, { clientName: clientMap.get(inv.clientId) ?? "Unknown" }),
  );
});

router.get("/invoices/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = GetInvoiceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, parsed.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const inv = rows[0]!;
  const clientMap = await loadClientNames([inv]);
  res.json(serializeInvoice(inv, { clientName: clientMap.get(inv.clientId) ?? "Unknown" }));
});

router.patch("/invoices/:id", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const paramsParsed = UpdateInvoiceParams.safeParse(req.params);
  const bodyParsed = UpdateInvoiceBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = bodyParsed.data;
  const existing = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.id, paramsParsed.data.id))
    .limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const cur = existing[0]!;
  const update: Record<string, unknown> = {};
  if (data.clientId !== undefined) update.clientId = data.clientId;
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "paid" && !cur.paidAt) update.paidAt = new Date();
    if (data.status !== "paid") update.paidAt = null;
  }
  if (data.issueDate !== undefined) update.issueDate = data.issueDate.toISOString().slice(0, 10);
  if (data.dueDate !== undefined) {
    update.dueDate = data.dueDate ? data.dueDate.toISOString().slice(0, 10) : null;
  }
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.items !== undefined || data.tax !== undefined) {
    const items = (data.items ?? (cur.items ?? [])).map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
    }));
    const tax = data.tax !== undefined ? Number(data.tax ?? 0) : Number(cur.tax);
    const totals = computeTotals(items, tax);
    update.items = items;
    update.subtotal = totals.subtotal;
    update.tax = totals.tax;
    update.total = totals.total;
  }
  const updated = await db
    .update(invoicesTable)
    .set(update)
    .where(eq(invoicesTable.id, paramsParsed.data.id))
    .returning();
  const inv = updated[0]!;
  const clientMap = await loadClientNames([inv]);
  res.json(serializeInvoice(inv, { clientName: clientMap.get(inv.clientId) ?? "Unknown" }));
});

router.delete("/invoices/:id", requireAdmin, async (req: AuthedRequest, res: Response) => {
  const parsed = DeleteInvoiceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
