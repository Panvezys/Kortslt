import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, or, isNull } from "drizzle-orm";
import { db, coachesTable, courtCoachesTable, courtCoachInvitationsTable, courtsTable, facilitiesTable } from "@workspace/db";
import { requireAuth, getCurrentUserId, isOwner, getUserRole, requireCoach, requireOwner } from "../lib/auth";
import { sendNotification } from "../lib/notify";
import { sendCoachInviteEmail } from "../lib/email";
import { z } from "zod";
import { EmailString, OptionalEmailString, OptionalPhoneString } from "@workspace/api-zod";

const CoachUpsertBody = z.object({
  name: z.string().trim().min(2, "Vardas privalomas"),
  email: EmailString,
  bio: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  pricePerHour: z.union([z.number(), z.string()]).optional().nullable(),
  sports: z.array(z.string()).optional(),
  availabilityDescription: z.string().optional().nullable(),
  phone: OptionalPhoneString,
});

const CoachInviteBody = z.object({
  targetUserId: z.string().optional(),
  targetEmail: OptionalEmailString,
  targetName: z.string().optional(),
}).refine(d => d.targetUserId || d.targetEmail, {
  message: "Reikia targetUserId arba targetEmail",
});

const CoachApplyBody = z.object({
  message: z.string().optional(),
  name: z.string().trim().min(2, "Vardas privalomas").optional(),
  email: OptionalEmailString,
});

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

// GET /coaches — list approved coaches, or filter by courtId. Each coach is
// enriched with `cities: string[]` from the courts/facilities they teach at.
router.get("/coaches", async (req, res): Promise<void> => {
  const courtId = req.query.courtId ? parseInt(req.query.courtId as string, 10) : null;

  let coaches: Array<typeof coachesTable.$inferSelect>;
  if (courtId !== null && !isNaN(courtId)) {
    const rows = await db
      .select({ coach: coachesTable })
      .from(courtCoachesTable)
      .innerJoin(coachesTable, eq(courtCoachesTable.coachId, coachesTable.id))
      .where(and(eq(courtCoachesTable.courtId, courtId), eq(coachesTable.status, "approved")));
    coaches = rows.map(r => r.coach);
  } else {
    coaches = await db
      .select()
      .from(coachesTable)
      .where(eq(coachesTable.status, "approved"))
      .orderBy(coachesTable.createdAt);
  }

  if (coaches.length === 0) { res.json([]); return; }

  const cityRows = await db
    .select({
      coachId: courtCoachesTable.coachId,
      facilityCity: facilitiesTable.city,
      courtCity: courtsTable.city,
    })
    .from(courtCoachesTable)
    .innerJoin(courtsTable, eq(courtCoachesTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(inArray(courtCoachesTable.coachId, coaches.map(c => c.id)));

  const citiesByCoach = new Map<number, Set<string>>();
  for (const row of cityRows) {
    const c = row.facilityCity ?? row.courtCity;
    if (!c) continue;
    if (!citiesByCoach.has(row.coachId)) citiesByCoach.set(row.coachId, new Set());
    citiesByCoach.get(row.coachId)!.add(c);
  }

  res.json(coaches.map(c => ({
    ...formatPublicCoach(c),
    cities: Array.from(citiesByCoach.get(c.id) ?? []),
  })));
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
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [coach] = await db
    .select()
    .from(coachesTable)
    .where(and(eq(coachesTable.id, id), eq(coachesTable.status, "approved")));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }
  res.json(formatPublicCoach(coach));
});

// GET /coaches/:id/facilities — public list of facilities/courts a coach is approved at.
// Only publicly-visible courts (status approved/active) and verified facilities are returned.
router.get("/coaches/:id/facilities", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [coach] = await db.select().from(coachesTable)
    .where(and(eq(coachesTable.id, id), eq(coachesTable.status, "approved")));
  if (!coach) { res.json([]); return; }

  const rows = await db
    .select({ court: courtsTable, facility: facilitiesTable })
    .from(courtCoachesTable)
    .innerJoin(courtsTable, eq(courtCoachesTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(and(
      eq(courtCoachesTable.coachId, id),
      inArray(courtsTable.status, ["approved", "active"]),
      // If court is in a facility, that facility must be verified.
      // Standalone courts (no facility) pass this check via the OR.
      or(
        isNull(courtsTable.facilityId),
        eq(facilitiesTable.verificationStatus, "active"),
      )!,
    ));

  type Group = {
    facilityId: number | null;
    facilityName: string | null;
    city: string | null;
    address: string | null;
    courts: Array<{ id: number; name: string }>;
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = r.facility?.id != null ? `f${r.facility.id}` : `c${r.court.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        facilityId: r.facility?.id ?? null,
        facilityName: r.facility?.name ?? r.court.name,
        city: r.facility?.city ?? r.court.city ?? null,
        address: r.facility?.address ?? r.court.address ?? null,
        courts: [],
      });
    }
    groups.get(key)!.courts.push({ id: r.court.id, name: r.court.name });
  }
  res.json(Array.from(groups.values()));
});

// POST /coaches — create coach profile (coach role required, one per user)
router.post("/coaches", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  const callerRole = await getUserRole(userId);
  if (callerRole !== "coach" && callerRole !== "admin") {
    res.status(403).json({ error: "Forbidden – coach role required" });
    return;
  }

  const parsed = CoachUpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = parsed.data;

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
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = getCurrentUserId(req)!;
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, id));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  const canEdit = await isOwner(req, coach.userId);
  if (!canEdit && coach.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CoachUpsertBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = parsed.data;

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

  const parsed = CoachUpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { name, email, bio, photoUrl, videoUrl, pricePerHour, sports, availabilityDescription, phone } = parsed.data;

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
  const courtId = parseInt(String(req.params.id), 10);
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
  const courtId = parseInt(String(req.params.id), 10);
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
  const courtId = parseInt(String(req.params.id), 10);
  const coachId = parseInt(String(req.params.coachId), 10);
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
  const courtId = parseInt(String(req.params.id), 10);
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
  const courtId = parseInt(String(req.params.id), 10);
  if (isNaN(courtId)) { res.status(400).json({ error: "Invalid court id" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CoachInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { targetUserId, targetEmail, targetName } = parsed.data;

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
  const courtId = parseInt(String(req.params.id), 10);
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

  const parsed = CoachApplyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const { message, name, email } = parsed.data;

  const [application] = await db.insert(courtCoachInvitationsTable).values({
    courtId,
    targetUserId: userId,
    targetEmail: email ?? null,
    targetName: name ?? null,
    initiatedBy: "coach",
    status: "pending",
    message: message ?? null,
  }).returning();

  if (court.ownerUserId) {
    await sendNotification(court.ownerUserId, "coach_application",
      "Trenerio paraiška",
      `${name ?? "Vartotojas"} prašo prisijungti prie „${court.name}" kaip treneris`,
      `/owner/facilities`
    ).catch(() => {});
  }

  res.status(201).json({ ...application, createdAt: application.createdAt.toISOString() });
});

// PUT /courts/:id/coach-invitations/:inviteId — approve or reject
router.put("/courts/:id/coach-invitations/:inviteId", requireAuth, async (req, res): Promise<void> => {
  const courtId = parseInt(String(req.params.id), 10);
  const inviteId = parseInt(String(req.params.inviteId), 10);
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

// ─── Facility-level coach marketplace ────────────────────────────────────────

// POST /coaches/apply-to-facility — coach applies to teach at every court in a facility
router.post("/coaches/apply-to-facility", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { facilityId, message } = req.body ?? {};
  const fid = Number(facilityId);
  if (!Number.isFinite(fid)) { res.status(400).json({ error: "facilityId is required" }); return; }

  const [facility] = await db.select().from(facilitiesTable).where(eq(facilitiesTable.id, fid));
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }

  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));
  if (!coach) { res.status(400).json({ error: "Create your coach profile first" }); return; }

  const facilityCourts = await db.select().from(courtsTable).where(eq(courtsTable.facilityId, fid));
  if (facilityCourts.length === 0) { res.status(400).json({ error: "Facility has no courts" }); return; }

  const courtIds = facilityCourts.map(c => c.id);

  // Skip courts where this coach is already approved
  const alreadyLinked = await db.select({ courtId: courtCoachesTable.courtId })
    .from(courtCoachesTable)
    .where(and(eq(courtCoachesTable.coachId, coach.id), inArray(courtCoachesTable.courtId, courtIds)));
  const linkedCourtIds = new Set(alreadyLinked.map(r => r.courtId));

  // Skip courts with an existing pending invitation by this coach
  const existingPending = await db.select({ courtId: courtCoachInvitationsTable.courtId })
    .from(courtCoachInvitationsTable)
    .where(and(
      eq(courtCoachInvitationsTable.targetUserId, userId),
      eq(courtCoachInvitationsTable.initiatedBy, "coach"),
      eq(courtCoachInvitationsTable.status, "pending"),
      inArray(courtCoachInvitationsTable.courtId, courtIds),
    ));
  const pendingCourtIds = new Set(existingPending.map(r => r.courtId));

  const toInsert = facilityCourts
    .filter(c => !linkedCourtIds.has(c.id) && !pendingCourtIds.has(c.id))
    .map(c => ({
      courtId: c.id,
      targetUserId: userId,
      targetEmail: coach.email,
      targetName: coach.name,
      initiatedBy: "coach" as const,
      status: "pending" as const,
      message: message ?? null,
    }));

  if (toInsert.length === 0) {
    res.status(409).json({ error: "Already applied or active at every court in this facility", created: 0 });
    return;
  }

  const created = await db.insert(courtCoachInvitationsTable).values(toInsert).returning();

  if (facility.ownerUserId) {
    await sendNotification(facility.ownerUserId, "coach_application",
      "Naujas trenerio prašymas",
      `${coach.name} prašo dirbti „${facility.name}"`,
      `/owner/coaches`,
    ).catch(() => {});
  }

  res.status(201).json({
    created: created.length,
    skipped: facilityCourts.length - created.length,
    invitations: created.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })),
  });
});

// GET /coaches/me/applications — own invitations (both directions) with court+facility info
router.get("/coaches/me/applications", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const rows = await db
    .select({
      invitation: courtCoachInvitationsTable,
      court: courtsTable,
      facility: facilitiesTable,
    })
    .from(courtCoachInvitationsTable)
    .innerJoin(courtsTable, eq(courtCoachInvitationsTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(eq(courtCoachInvitationsTable.targetUserId, userId))
    .orderBy(desc(courtCoachInvitationsTable.createdAt));

  res.json(rows.map(r => ({
    id: r.invitation.id,
    courtId: r.invitation.courtId,
    courtName: r.court.name,
    facilityId: r.facility?.id ?? null,
    facilityName: r.facility?.name ?? null,
    city: r.facility?.city ?? r.court.city ?? null,
    initiatedBy: r.invitation.initiatedBy,
    status: r.invitation.status,
    message: r.invitation.message,
    createdAt: r.invitation.createdAt.toISOString(),
  })));
});

// GET /coaches/me/facilities — facilities the coach is approved at, grouped
router.get("/coaches/me/facilities", requireCoach, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.userId, userId));
  if (!coach) { res.json([]); return; }

  const rows = await db
    .select({ court: courtsTable, facility: facilitiesTable })
    .from(courtCoachesTable)
    .innerJoin(courtsTable, eq(courtCoachesTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(eq(courtCoachesTable.coachId, coach.id));

  // Group by facility (or by orphan court if no facility)
  type Group = {
    facilityId: number | null;
    facilityName: string | null;
    city: string | null;
    courts: Array<{ id: number; name: string }>;
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = r.facility?.id != null ? `f${r.facility.id}` : `c${r.court.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        facilityId: r.facility?.id ?? null,
        facilityName: r.facility?.name ?? null,
        city: r.facility?.city ?? r.court.city ?? null,
        courts: [],
      });
    }
    groups.get(key)!.courts.push({ id: r.court.id, name: r.court.name });
  }
  res.json(Array.from(groups.values()));
});

// GET /owner/coach-requests — pending coach-initiated invitations across owner's courts
router.get("/owner/coach-requests", requireOwner, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const rows = await db
    .select({
      invitation: courtCoachInvitationsTable,
      court: courtsTable,
      facility: facilitiesTable,
      coach: coachesTable,
    })
    .from(courtCoachInvitationsTable)
    .innerJoin(courtsTable, eq(courtCoachInvitationsTable.courtId, courtsTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .leftJoin(coachesTable, eq(courtCoachInvitationsTable.targetUserId, coachesTable.userId))
    .where(and(
      eq(courtsTable.ownerUserId, userId),
      eq(courtCoachInvitationsTable.initiatedBy, "coach"),
      eq(courtCoachInvitationsTable.status, "pending"),
    ))
    .orderBy(desc(courtCoachInvitationsTable.createdAt));

  res.json(rows.map(r => ({
    invitationId: r.invitation.id,
    courtId: r.court.id,
    courtName: r.court.name,
    facilityId: r.facility?.id ?? null,
    facilityName: r.facility?.name ?? null,
    message: r.invitation.message,
    createdAt: r.invitation.createdAt.toISOString(),
    coach: r.coach ? formatPublicCoach(r.coach) : {
      id: null,
      userId: r.invitation.targetUserId,
      name: r.invitation.targetName ?? "Treneris",
      email: r.invitation.targetEmail ?? null,
    },
  })));
});

// POST /owner/respond-to-coach — owner approves or rejects a pending coach request
router.post("/owner/respond-to-coach", requireOwner, async (req, res): Promise<void> => {
  const { invitationId, decision } = req.body ?? {};
  const id = Number(invitationId);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "invitationId required" }); return; }
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "decision must be 'approve' or 'reject'" }); return;
  }

  const [invite] = await db.select().from(courtCoachInvitationsTable)
    .where(eq(courtCoachInvitationsTable.id, id));
  if (!invite) { res.status(404).json({ error: "Invitation not found" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, invite.courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const canEdit = await isOwner(req, court.ownerUserId);
  if (!canEdit) { res.status(403).json({ error: "Forbidden – not the court owner" }); return; }

  if (invite.status !== "pending") {
    res.status(409).json({ error: `Invitation already ${invite.status}` }); return;
  }

  await db.update(courtCoachInvitationsTable)
    .set({ status: decision === "approve" ? "approved" : "rejected" })
    .where(eq(courtCoachInvitationsTable.id, id));

  if (decision === "approve" && invite.targetUserId) {
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
      .where(and(eq(courtCoachesTable.courtId, court.id), eq(courtCoachesTable.coachId, coach.id)));
    if (!existing) {
      try {
        await db.insert(courtCoachesTable).values({ courtId: court.id, coachId: coach.id });
      } catch (err: unknown) {
        // Postgres unique_violation (23505) — a concurrent approval already created the link.
        // The end state (coach approved on this court) is what we want, so swallow and continue.
        const code = (err as { code?: string } | null)?.code;
        if (code !== "23505") throw err;
      }
    }
    await sendNotification(invite.targetUserId, "court_coach_approved",
      "Paraiška patvirtinta",
      `Jūs priimtas kaip treneris į „${court.name}"`,
      `/coach/me`,
    ).catch(() => {});
  } else if (decision === "reject" && invite.targetUserId) {
    await sendNotification(invite.targetUserId, "court_coach_rejected",
      "Paraiška atmesta",
      `Jūsų paraiška „${court.name}" buvo atmesta`,
      `/coach/me`,
    ).catch(() => {});
  }

  res.json({ ok: true, status: decision === "approve" ? "approved" : "rejected" });
});

// GET /owner/coach-roster — all approved coaches across owner's courts (for roster management)
router.get("/owner/coach-roster", requireOwner, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const rows = await db
    .select({ court: courtsTable, facility: facilitiesTable, coach: coachesTable })
    .from(courtCoachesTable)
    .innerJoin(courtsTable, eq(courtCoachesTable.courtId, courtsTable.id))
    .innerJoin(coachesTable, eq(courtCoachesTable.coachId, coachesTable.id))
    .leftJoin(facilitiesTable, eq(courtsTable.facilityId, facilitiesTable.id))
    .where(eq(courtsTable.ownerUserId, userId))
    .orderBy(courtsTable.name);

  res.json(rows.map(r => ({
    courtId: r.court.id,
    courtName: r.court.name,
    facilityId: r.facility?.id ?? null,
    facilityName: r.facility?.name ?? null,
    coach: formatPublicCoach(r.coach),
  })));
});

export default router;
