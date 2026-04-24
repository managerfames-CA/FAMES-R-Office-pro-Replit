import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type UserRow } from "@workspace/db";

const SESSION_COOKIE = "office_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const target = Buffer.from(hash, "hex");
  if (target.length !== derived.length) return false;
  return timingSafeEqual(derived, target);
}

export function newSessionId(): string {
  return createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
}

export async function createSession(userId: number): Promise<{ id: string; expiresAt: Date }> {
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function destroySession(id: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
}

export function setSessionCookie(res: Response, id: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export interface AuthedRequest extends Request {
  user?: UserRow;
  sessionId?: string;
}

async function lookupUserBySession(sessionId: string): Promise<UserRow | null> {
  const rows = await db
    .select({
      session: sessionsTable,
      user: usersTable,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(and(eq(sessionsTable.id, sessionId), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0]!.user;
}

export async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const sid = cookies?.[SESSION_COOKIE];
  if (!sid) {
    next();
    return;
  }
  try {
    const user = await lookupUserBySession(sid);
    if (user) {
      req.user = user;
      req.sessionId = sid;
    }
  } catch {
    // ignore; treat as unauthenticated
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
