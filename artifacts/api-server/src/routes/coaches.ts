import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, coachesTable, courtCoachesTable, courtCoachInvitationsTable, courtsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner, getUserRole } from "../lib/auth";
import { sendNotification } from "../lib/notify";
import { sendCoachInviteEmail } from "../lib/email";

const router: IRouter = Router();

function formatCoach(c: typeof coachesTable.$inferSelect) {
  return {
    ...c,
    pricePerHour: c.pricePerHour != null ? Number(c.pricePerHour) : undefined,
    bio: c.bio ?? undefined,
    photoUrl: c.photoUrl ?? undefined,
    videoUrl: c.videoUrl ?? undefined,
    availabilityDescription: c.availabilityDescription ?? undefined,
    phone: c.phone ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

function formatPublicCoach(c: typeof coachesTable.$inferSelect) {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    bio: c.bio ?? undefined,
    photoUrl: c.photoUrl ?? undefined,
    videoUrl: c.videoUrl ?? undefined,
    pricePerHour: c.pricePerHour != null ? Number(c.pricePerHour) : undefined,
    sports: c.sports,
    availabilityDescription: c.availabilityDescription ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

// GET /coaches — list approved coaches, or filter by courtId
router.get("/coaches", async (req, res): Promise<void> => {
  const courtId = req.query.courtId ? parseInt(req.query.courtId as string, 10) : null;

  if (courtId !== null && !isNaN(courtId)) {
    const rows = await db
      .select({ coach: coachesTable })
      .from(courtCoachesTable)
      .innerJoin(coachesTable, eq(courtCoachesTable.coachId, coachesTable.id))
      .where(and(eq(courtCoachesTable.courtId, courtId), eq(coachesTable.status, "approved")));
    res.json(rows.map((r) => formatPublicCoach(r.coach)));
    return;
  }

  const coaches = await db
    .select()
    .from(coachesTable)
    .where(eq(coachesTable.status, "approved"))
    .orderBy(coachesTable.createdAt);
  res.json(coaches.map(formatPublicCoach));
});

// GET /coaches/me — get own coach profile
router.get("/coaches/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));
  if (!coach) {
    res.status(404).json({ error: "No coach profile found" });
    return;
  }
  res.json(formatCoach(coach));
});

// GET /coaches/:id — get approved coach by id
router.get("/coaches/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [coach] = await db
    .select()
    .from(coachesTable)
    .where(and(eq(coachesTable.id, id), eq(coachesTable.status, "approved")));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }
  res.json(formatPublicCoach(coach));
});

// POST /coaches — create coach profile (coach role required, one per user)
router.post("/coaches", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  const callerRole = await getUserRole(userId);
  if (callerRole !== "coach" && callerRole !== "admin") {
    res.status(403).json({ error: "Forbidden – coach role required" });
    return;
  }

  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  const [existing] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));
  if (existing) {
    res.status(409).json({ error: "Coach profile already exists for this user. Use PUT to update." });
    return;
  }

  const [coach] = await db.insert(coachesTable).values({
    userId,
    name,
    email,
    bio: bio ?? null,
    photoUrl: photoUrl ?? null,
    videoUrl: videoUrl ?? null,
    pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
    sports: sports ?? [],
    availabilityDescription: availabilityDescription ?? null,
    phone: phone ?? null,
  }).returning();

  res.status(201).json(formatCoach(coach));
});

// PUT /coaches/:id — update coach profile (own profile or admin)
router.put("/coaches/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = getCurrentUserId(req)!;
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, id));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  const canEdit = await isOwner(req, coach.userId);
  if (!canEdit && coach.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = req.body;

  const [updated] = await db.update(coachesTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    bio: bio ?? null,
    photoUrl: photoUrl ?? null,
    videoUrl: videoUrl ?? null,
    pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
    ...(sports !== undefined && { sports }),
    availabilityDescription: availabilityDescription ?? null,
    phone: phone ?? null,
  }).where(eq(coachesTable.id, id)).returning();

  res.json(formatCoach(updated));
});

// PUT /coaches/me — update own coach profile (coach role required)
router.put("/coaches/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  const callerRole = await getUserRole(userId);
  if (callerRole !== "coach" && callerRole !== "admin") {
    res.status(403).json({ error: "Forbidden – coach role required" });
    return;
  }

  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  const [existing] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));

  if (existing) {
    const [updated] = await db.update(coachesTable).set({
      name, email,
      bio: bio ?? null,
      photoUrl: photoUrl ?? null,
      videoUrl: videoUrl ?? null,
      pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
      sports: sports ?? [],
      availabilityDescription: availabilityDescription ?? null,
      phone: phone ?? null,
    }).where(eq(coachesTable.userId, userId)).returning();
    res.json(formatCoach(updated));
  } else {
    const [created] = await db.insert(coachesTable).values({
      userId, name, email,
      bio: bio ?? null,
      photoUrl: photoUrl ?? null,
      videoUrl: videoUrl ?? null,
      pricePerHour: pricePerHour != null ? String(pricePerHour) : null,
      sports: sports ?? [],
      availabilityDescription: availabilityDescription ?? null,
      phone: phone ?? null,
    }).returning();
    res.status(201).json(formatCoach(created));
  }
});

// GET /courts/:id/coaches — approved coaches assigned to court
router.get("/courts/:id/coaches", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const rows = await db
    .select({ coach: coachesTable })
    .from(courtCoachesTable)
    .innerJoin(coachesTable, eq(courtCoachesTable.coachId, coachesTable.id))
    .where(and(eq(courtCoachesTable.courtId, courtId), eq(coachesTable.status, "approved")));

  res.json(rows.map((r) => formatPublicCoach(r.coach)));
});

// POST /courts/:id/coaches — assign a coach to court (court owner only)
router.post("/courts/:id/coaches", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const { coachId } = req.body;
  if (!coachId) { res.status(400).json({ error: "coachId is required" }); return; }

  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, coachId));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  const [existing] = await db.select().from(courtCoachesTable)
    .where(and(eq(courtCoachesTable.courtId, courtId), eq(courtCoachesTable.coachId, coachId)));
  if (existing) { res.status(409).json({ error: "Coach already assigned to this court" }); return; }

  await db.insert(courtCoachesTable).values({ courtId, coachId });
  res.status(201).json({ ok: true });
});

// DELETE /courts/:id/coaches/:coachId — remove coach from court (court owner only)
router.delete("/courts/:id/coaches/:coachId", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  const coachId = parseInt(req.params.coachId, 10);
  if (isNaN(courtId) || isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(courtCoachesTable)
    .where(and(eq(courtCoachesTable.courtId, courtId), eq(courtCoachesTable.coachId, coachId)));

  res.json({ ok: true });
});

// GET /courts/:id/coach-invitations — list all invitations + applications (owner only)
router.get("/courts/:id/coach-invitations", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const invitations = await db.select().from(courtCoachInvitationsTable)
    .where(eq(courtCoachInvitationsTable.courtId, courtId))
    .orderBy(desc(courtCoachInvitationsTable.createdAt));

  res.json(invitations.map(inv => ({ ...inv, createdAt: inv.createdAt.toISOString() })));
});

// POST /courts/:id/coach-invite — owner invites a user (by userId) or by email
router.post("/courts/:id/coach-invite", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const { targetUserId, targetEmail, targetName } = req.body ?? {};
  if (!targetUserId && !targetEmail) {
    res.status(400).json({ error: "targetUserId or targetEmail required" }); return;
  }

  if (targetUserId) {
    const [existingPending] = await db.select().from(courtCoachInvitationsTable)
      .where(and(
        eq(courtCoachInvitationsTable.courtId, courtId),
        eq(courtCoachInvitationsTable.targetUserId, targetUserId),
        eq(courtCoachInvitationsTable.status, "pending"),
      ));
    if (existingPending) { res.status(409).json({ error: "Already invited" }); return; }
  }

  const [invitation] = await db.insert(courtCoachInvitationsTable).values({
    courtId,
    targetUserId: targetUserId ?? null,
    targetEmail: targetEmail ?? null,
    targetName: targetName ?? null,
    initiatedBy: "owner",
    status: "pending",
  }).returning();

  if (targetUserId) {
    await sendNotification(targetUserId, "coach_invite",
      "Kvietimas tapti treneriumi",
      `Jūs esate pakviesti prisijungti prie „${court.name}" kaip treneris`,
      `/courts/${courtId}`
    ).catch(() => {});
  } else if (targetEmail) {
    const siteUrl = process.env.SITE_URL || "https://korts.lt";
    await sendCoachInviteEmail({
      toEmail: targetEmail,
      toName: targetName ?? targetEmail,
      courtName: court.name,
      acceptLink: `${siteUrl}/courts/${courtId}`,
    }).catch(() => {});
  }

  res.status(201).json({ ...invitation, createdAt: invitation.createdAt.toISOString() });
});

// POST /courts/:id/coach-apply — a user applies to be a coach at this court
router.post("/courts/:id/coach-apply", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const userId = getCurrentUserId(req)!;
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const [existingPending] = await db.select().from(courtCoachInvitationsTable)
    .where(and(
      eq(courtCoachInvitationsTable.courtId, courtId),
      eq(courtCoachInvitationsTable.targetUserId, userId),
      eq(courtCoachInvitationsTable.initiatedBy, "coach"),
      eq(courtCoachInvitationsTable.status, "pending"),
    ));
  if (existingPending) { res.status(409).json({ error: "Application already submitted" }); return; }

  const { message, name, email } = req.body ?? {};

  const [application] = await db.insert(courtCoachInvitationsTable).values({
    courtId,
    targetUserId: userId,
    targetEmail: email ?? null,
    targetName: name ?? null,
    initiatedBy: "coach",
    status: "pending",
    message: message ?? null,
  }).returning();

  await sendNotification(court.ownerUserId, "coach_application",
    "Trenerio paraiška",
    `${name ?? "Vartotojas"} prašo prisijungti prie „${court.name}" kaip treneris`,
    `/owner/facilities`
  ).catch(() => {});

  res.status(201).json({ ...application, createdAt: application.createdAt.toISOString() });
});

// PUT /courts/:id/coach-invitations/:inviteId — approve or reject
router.put("/courts/:id/coach-invitations/:inviteId", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  const inviteId = parseInt(req.params.inviteId, 10);
  if (isNaN(courtId) || isNaN(inviteId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const { action } = req.body ?? {};
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" }); return;
  }

  const [invite] = await db.select().from(courtCoachInvitationsTable)
    .where(and(eq(courtCoachInvitationsTable.id, inviteId), eq(courtCoachInvitationsTable.courtId, courtId)));
  if (!invite) { res.status(404).json({ error: "Invitation not found" }); return; }

  await db.update(courtCoachInvitationsTable)
    .set({ status: action === "approve" ? "approved" : "rejected" })
    .where(eq(courtCoachInvitationsTable.id, inviteId));

  if (action === "approve" && invite.targetUserId) {
    let [coach] = await db.select().from(coachesTable)
      .where(eq(coachesTable.userId, invite.targetUserId));
    if (!coach) {
      [coach] = await db.insert(coachesTable).values({
        userId: invite.targetUserId,
        name: invite.targetName ?? "Treneris",
        email: invite.targetEmail ?? "",
        status: "approved",
        sports: [],
      }).returning();
    }
    const [existing] = await db.select().from(courtCoachesTable)
      .where(and(eq(courtCoachesTable.courtId, courtId), eq(courtCoachesTable.coachId, coach.id)));
    if (!existing) {
      await db.insert(courtCoachesTable).values({ courtId, coachId: coach.id });
    }
    await sendNotification(invite.targetUserId, "court_coach_approved",
      "Paraiška patvirtinta",
      `Jūs priimtas kaip treneris į „${court.name}"`,
      `/courts/${courtId}`
    ).catch(() => {});
  } else if (action === "reject" && invite.targetUserId) {
    await sendNotification(invite.targetUserId, "court_coach_rejected",
      "Paraiška atmesta",
      `Jūsų paraiška prisijungti prie „${court.name}" kaip treneris buvo atmesta`,
      `/courts/${courtId}`
    ).catch(() => {});
  }

  res.json({ ok: true });
});

export default router;
