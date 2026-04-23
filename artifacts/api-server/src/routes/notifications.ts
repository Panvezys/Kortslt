import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { ADMIN_NOTIF_USER } from "../lib/notify";

const router: IRouter = Router();

/** GET /notifications — fetch notifications for the authenticated user (newest first) */
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId!))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(rows);
});

/** PATCH /notifications/:id/read — mark one notification as read (must belong to caller) */
router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { userId } = getAuth(req);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId!)))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

/** POST /notifications/read-all — mark all as read for the authenticated user */
router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, userId!), eq(notificationsTable.read, false)));

  res.json({ ok: true });
});

/** GET /admin/notifications — fetch pending-review notifications for admin */
router.get("/admin/notifications", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, ADMIN_NOTIF_USER))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(rows);
});

/** PATCH /admin/notifications/:id/read — mark admin notification as read */
router.patch("/admin/notifications/:id/read", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
export { notificationsTable };
