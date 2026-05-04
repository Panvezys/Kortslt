import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { userRolesTable, coachesTable, userProfilesTable } from "@workspace/db/schema";
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

/** DELETE /me/role-request — cancel the user's pending role request */
router.delete("/me/role-request", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [existing] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  if (!existing || existing.status !== "pending_approval" || !existing.pendingRole) {
    res.status(400).json({ error: "Nėra aktyvaus prašymo, kurį būtų galima atšaukti" });
    return;
  }

  const cancelledRole = existing.pendingRole;

  const [row] = await db
    .update(userRolesTable)
    .set({
      status: "active",
      pendingRole: null,
      requestData: null,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(userRolesTable.userId, userId))
    .returning();

  const roleLabel = cancelledRole === "coach" ? "trenerio" : "savininko";
  await sendAdminNotification(
    `${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} rolės užklausa atšaukta`,
    `Vartotojas atšaukė savo prašymą gauti ${roleLabel} teises.`,
    "/admin/roles",
  ).catch(() => {});

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
  const userId = String(req.params.userId);

  const [existing] = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId));
  if (!existing || existing.status !== "pending_approval" || !existing.pendingRole) {
    res.status(404).json({ error: "No pending role request found" }); return;
  }

  const newRole = existing.pendingRole;
  const requestData: Record<string, unknown> = existing.requestData
    ? (() => { try { return JSON.parse(existing.requestData!) as Record<string, unknown>; } catch { return {}; } })()
    : {};

  if (newRole === "coach") {
    const sportsArr: string[] = Array.isArray(requestData.sports)
      ? (requestData.sports as unknown[]).map(String)
      : [];
    const pricePerHour = requestData.pricePerHour != null ? String(requestData.pricePerHour) : null;
    await db
      .insert(coachesTable)
      .values({
        userId,
        name: (requestData.name as string | undefined) ?? "Coach",
        email: (requestData.email as string | undefined) ?? "",
        bio: (requestData.bio as string | undefined) ?? null,
        photoUrl: (requestData.photoUrl as string | undefined) ?? null,
        pricePerHour,
        sports: sportsArr,
        availabilityDescription: (requestData.availabilityDescription as string | undefined) ?? null,
        phone: (requestData.phone as string | undefined) ?? null,
      })
      .onConflictDoUpdate({
        target: coachesTable.userId,
        set: {
          bio: (requestData.bio as string | undefined) ?? null,
          sports: sportsArr,
          pricePerHour,
          availabilityDescription: (requestData.availabilityDescription as string | undefined) ?? null,
          phone: (requestData.phone as string | undefined) ?? null,
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

  // Sync Clerk publicMetadata so JWT/session reflects the new role
  await clerkClient.users
    .updateUserMetadata(userId, { publicMetadata: { role: newRole } })
    .catch(() => {});

  res.json(row);
});

/** POST /admin/role-requests/:userId/reject — reject a role request */
router.post("/admin/role-requests/:userId/reject", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const { reason } = req.body as { reason?: string };

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

  // Enrich with Clerk user data (name, email, avatar). Chunk in batches of 100
  // because the Clerk SDK caps `limit` at 100 per request.
  const userIds = rows.map(r => r.userId);
  const clerkUsers: Record<string, { name: string | null; email: string | null; avatarUrl: string | null }> = {};
  const CHUNK = 100;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    try {
      const clerkResp = await clerkClient.users.getUserList({ userId: chunk, limit: CHUNK });
      for (const cu of clerkResp.data) {
        const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
        const email = cu.emailAddresses?.[0]?.emailAddress ?? null;
        clerkUsers[cu.id] = { name, email, avatarUrl: cu.imageUrl ?? null };
      }
    } catch {
      // If a Clerk call fails, proceed without enrichment for that chunk
    }
  }

  const profiles = userIds.length > 0
    ? await db
        .select({ userId: userProfilesTable.userId, stripeAccountStatus: userProfilesTable.stripeAccountStatus })
        .from(userProfilesTable)
        .where(inArray(userProfilesTable.userId, userIds))
    : [];
  const stripeMap = new Map(profiles.map(p => [p.userId, p.stripeAccountStatus ?? "not_connected"]));

  const enriched = rows.map(r => ({
    ...r,
    name: clerkUsers[r.userId]?.name ?? null,
    email: clerkUsers[r.userId]?.email ?? null,
    avatarUrl: clerkUsers[r.userId]?.avatarUrl ?? null,
    stripeAccountStatus: stripeMap.get(r.userId) ?? "not_connected",
  }));

  res.json(enriched);
});

const SetRoleBody = z.object({ role: z.enum(["player", "coach", "owner", "admin"]) });

/** PUT /admin/users/:userId/role — set a user's role directly (admin only) */
router.put("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
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

  // Sync Clerk publicMetadata so the JWT/session reflects the new role
  await clerkClient.users
    .updateUserMetadata(userId, { publicMetadata: { role: parsed.data.role } })
    .catch(() => {});

  res.json(row);
});

/** DELETE /admin/users/:userId/role — revert to player */
router.delete("/admin/users/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));

  // Reset Clerk publicMetadata role to player so the JWT/session is consistent
  await clerkClient.users
    .updateUserMetadata(userId, { publicMetadata: { role: "player" } })
    .catch(() => {});

  res.json({ userId, role: "player" });
});

export default router;
