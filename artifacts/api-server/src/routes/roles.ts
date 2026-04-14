import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { userRolesTable, userRoleSchema } from "@workspace/db/schema";
import { requireAuth, requireAdmin, ensureUserRole, getUserRole } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { z } from "zod";

const router: IRouter = Router();

/** GET /me/role — returns the current user's role, auto-creates player if first visit */
router.get("/me/role", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const role = await ensureUserRole(userId!);
  res.json({ userId, role });
});

/** GET /admin/users — list all users with assigned roles (admin only) */
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(userRolesTable)
    .orderBy(userRolesTable.createdAt);
  res.json(rows);
});

const SetRoleBody = z.object({ role: userRoleSchema });

/** PUT /admin/users/:userId/role — set a user's role (admin only) */
router.put("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;
  const parsed = SetRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role. Must be admin, owner, or player." });
    return;
  }

  const [row] = await db
    .insert(userRolesTable)
    .values({ userId, role: parsed.data.role })
    .onConflictDoUpdate({
      target: userRolesTable.userId,
      set: { role: parsed.data.role, updatedAt: new Date() },
    })
    .returning();

  res.json(row);
});

/** DELETE /admin/users/:userId/role — remove a user's role (reverts to player) */
router.delete("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;
  await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
  res.json({ userId, role: "player" });
});

export default router;
