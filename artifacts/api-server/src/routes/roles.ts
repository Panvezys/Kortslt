import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { userRolesTable, userRoleSchema, coachesTable } from "@workspace/db/schema";
import { requireAuth, requireAdmin, ensureUserRole, getCurrentUserId } from "../lib/auth";
import { getAuth, clerkClient } from "@clerk/express";
import { z } from "zod";
import { sendAdminRoleRequestEmail } from "../lib/email";
import { sendAdminNotification } from "../lib/notify";

const router: IRouter = Router();

/** GET /me/role — returns the current user's role + status, auto-creates player if first visit */
router.get("/me/role", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const role = await ensureUserRole(userId!);
  const [row] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId!));
  res.json({
    userId,
    role,
    status: row?.status ?? "active",
    pendingRole: row?.pendingRole ?? null,
    rejectionReason: row?.rejectionReason ?? null,
  });
});

/** POST /me/request-role — submit a role upgrade request (coach or owner) */
const RequestRoleBody = z.object({
  pendingRole: z.enum(["coach", "owner"]),
  requestData: z.record(z.unknown()).optional(),
});

router.post("/me/request-role", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = RequestRoleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const { pendingRole, requestData } = parsed.data;

  const [existing] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  if (existing?.role === pendingRole) {
    res.status(400).json({ error: "You already have this role" }); return;
  }
  if (existing?.status === "pending_approval") {
    res.status(400).json({ error: "You already have a pending role request" }); return;
  }

  const [row] = await db
    .insert(userRolesTable)
    .values({
      userId,
      role: existing?.role ?? "player",
      status: "pending_approval",
      pendingRole,
      requestData: requestData ? JSON.stringify(requestData) : null,
      rejectionReason: null,
    })
    .onConflictDoUpdate({
      target: userRolesTable.userId,
      set: {
        status: "pending_approval",
        pendingRole,
        requestData: requestData ? JSON.stringify(requestData) : null,
        rejectionReason: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  await sendAdminRoleRequestEmail({
    userId,
    pendingRole,
    requestData: requestData ?? {},
  }).catch(() => {});

  const roleLabel = pendingRole === "coach" ? "trenerio" : "savininko";
  await sendAdminNotification(
    `Nauja ${roleLabel} rolės užklausa`,
    `Vartotojas pateikė prašymą gauti ${roleLabel} teises.`,
    "/admin/roles",
  );

  res.json(row);
});

/** GET /admin/role-requests — list all pending role requests (admin only) */
router.get("/admin/role-requests", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(userRolesTable)
    .where(eq(userRolesTable.status, "pending_approval"));
  res.json(rows);
});

/** POST /admin/role-requests/:userId/approve — approve a role request */
router.post("/admin/role-requests/:userId/approve", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;

  const [existing] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  if (!existing || existing.status !== "pending_approval" || !existing.pendingRole) {
    res.status(404).json({ error: "No pending role request found" }); return;
  }

  const newRole = existing.pendingRole as string;
  const requestData = existing.requestData ? (() => { try { return JSON.parse(existing.requestData!); } catch { return {}; } })() : {};

  if (newRole === "coach") {
    await db
      .insert(coachesTable)
      .values({
        userId,
        name: requestData.name ?? "Coach",
        email: requestData.email ?? "",
        bio: requestData.bio ?? null,
        photoUrl: requestData.photoUrl ?? null,
        pricePerHour: requestData.pricePerHour ? String(requestData.pricePerHour) : null,
        sports: Array.isArray(requestData.sports) ? requestData.sports : [],
        availabilityDescription: requestData.availabilityDescription ?? null,
        phone: requestData.phone ?? null,
      })
      .onConflictDoUpdate({
        target: coachesTable.userId,
        set: {
          bio: requestData.bio ?? null,
          sports: Array.isArray(requestData.sports) ? requestData.sports : [],
          pricePerHour: requestData.pricePerHour ? String(requestData.pricePerHour) : null,
          availabilityDescription: requestData.availabilityDescription ?? null,
          phone: requestData.phone ?? null,
        },
      });
  }

  const [row] = await db
    .update(userRolesTable)
    .set({
      role: newRole,
      status: "active",
      pendingRole: null,
      requestData: null,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(userRolesTable.userId, userId))
    .returning();

  res.json(row);
});

/** POST /admin/role-requests/:userId/reject — reject a role request */
router.post("/admin/role-requests/:userId/reject", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { reason } = req.body;

  const [row] = await db
    .update(userRolesTable)
    .set({
      status: "rejected",
      rejectionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.status, "pending_approval")))
    .returning();

  if (!row) { res.status(404).json({ error: "No pending request found" }); return; }
  res.json(row);
});

/** GET /admin/users — list all users with assigned roles + Clerk profile data (admin only) */
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(userRolesTable)
    .orderBy(userRolesTable.createdAt);

  if (rows.length === 0) { res.json([]); return; }

  // Enrich with Clerk user data (name, email, avatar)
  const userIds = rows.map(r => r.userId);
  let clerkUsers: Record<string, { name: string | null; email: string | null; avatarUrl: string | null }> = {};
  try {
    const clerkResp = await clerkClient.users.getUserList({ userId: userIds, limit: 500 });
    for (const cu of clerkResp.data) {
      const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
      const email = cu.emailAddresses?.[0]?.emailAddress ?? null;
      clerkUsers[cu.id] = { name, email, avatarUrl: cu.imageUrl ?? null };
    }
  } catch {
    // If Clerk call fails, proceed without enrichment
  }

  const enriched = rows.map(r => ({
    ...r,
    name: clerkUsers[r.userId]?.name ?? null,
    email: clerkUsers[r.userId]?.email ?? null,
    avatarUrl: clerkUsers[r.userId]?.avatarUrl ?? null,
  }));

  res.json(enriched);
});

const SetRoleBody = z.object({ role: userRoleSchema });

/** PUT /admin/users/:userId/role — set a user's role directly (admin only) */
router.put("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;
  const parsed = SetRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }

  const [row] = await db
    .insert(userRolesTable)
    .values({ userId, role: parsed.data.role })
    .onConflictDoUpdate({
      target: userRolesTable.userId,
      set: { role: parsed.data.role, status: "active", pendingRole: null, updatedAt: new Date() },
    })
    .returning();

  res.json(row);
});

/** DELETE /admin/users/:userId/role — revert to player */
router.delete("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;
  await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
  res.json({ userId, role: "player" });
});

export default router;
