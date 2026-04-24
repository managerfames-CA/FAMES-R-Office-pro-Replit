import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import {
  type AuthedRequest,
  attachUser,
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth";
import { serializeAuthUser } from "../lib/serializers";

const router: IRouter = Router();

router.use(attachUser);

router.post("/auth/login", async (req: AuthedRequest, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (user.status !== "active") {
    res.status(403).json({ error: "Account is inactive" });
    return;
  }
  if (!verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const session = await createSession(user.id);
  setSessionCookie(res, session.id, session.expiresAt);
  res.json(serializeAuthUser(user));
});

router.post("/auth/logout", async (req: AuthedRequest, res: Response) => {
  if (req.sessionId) {
    await destroySession(req.sessionId);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/me", requireAuth, (req: AuthedRequest, res: Response) => {
  res.json(serializeAuthUser(req.user!));
});

router.post(
  "/auth/change-password",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    if (!verifyPassword(currentPassword, req.user!.passwordHash)) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: "New password must be different" });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
      })
      .where(eq(usersTable.id, req.user!.id))
      .returning();
    res.json(serializeAuthUser(updated[0]!));
  },
);

export default router;
