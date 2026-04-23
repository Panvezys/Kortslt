import { Router, type IRouter } from "express";
import { desc, eq, or, and, inArray } from "drizzle-orm";
import { db, messagesTable, courtsTable, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function formatMsg(r: typeof messagesTable.$inferSelect) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

// GET /messages/inbox  — all threads the authenticated user participated in
router.get("/messages/inbox", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const rows = await db
    .select()
    .from(messagesTable)
    .where(or(eq(messagesTable.senderUserId, userId!), eq(messagesTable.recipientUserId, userId!)))
    .orderBy(desc(messagesTable.createdAt));

  // Group by courtId — each court is one thread
  const threadMap = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!threadMap.has(row.courtId)) threadMap.set(row.courtId, []);
    threadMap.get(row.courtId)!.push(row);
  }

  const courtIds = [...threadMap.keys()];
  const courts = courtIds.length
    ? await db.select({ id: courtsTable.id, name: courtsTable.name }).from(courtsTable).where(inArray(courtsTable.id, courtIds))
    : [];
  const courtNameMap = new Map(courts.map(c => [c.id, c.name]));

  const threads = [...threadMap.entries()].map(([courtId, msgs]) => ({
    courtId,
    courtName: courtNameMap.get(courtId) ?? `Kortas #${courtId}`,
    lastMessage: formatMsg(msgs[0]),
    unread: 0,
  }));

  res.json(threads);
});

// GET /messages/owner-inbox  — all threads across the authenticated owner's courts
router.get("/messages/owner-inbox", requireAuth, async (req, res): Promise<void> => {
  const { userId: ownerUserId } = getAuth(req);

  const ownedCourts = await db
    .select({ id: courtsTable.id, name: courtsTable.name })
    .from(courtsTable)
    .where(eq(courtsTable.ownerUserId, ownerUserId!));

  if (ownedCourts.length === 0) { res.json([]); return; }

  const courtIds = ownedCourts.map(c => c.id);
  const courtNameMap = new Map(ownedCourts.map(c => [c.id, c.name]));

  const rows = await db
    .select()
    .from(messagesTable)
    .where(inArray(messagesTable.courtId, courtIds))
    .orderBy(desc(messagesTable.createdAt));

  // Group by courtId + the non-owner userId (thread key)
  const threadMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const userSide = row.senderUserId === ownerUserId ? row.recipientUserId : row.senderUserId;
    const key = `${row.courtId}__${userSide}`;
    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(row);
  }

  const threads = [...threadMap.entries()].map(([key, msgs]) => {
    const [courtIdStr, threadUserId] = key.split("__");
    const courtId = Number(courtIdStr);
    const first = msgs[0];
    const userSide = first.senderUserId === ownerUserId ? first : msgs.find(m => m.senderUserId !== ownerUserId) ?? first;
    return {
      courtId,
      courtName: courtNameMap.get(courtId) ?? `Kortas #${courtId}`,
      threadUserId,
      threadUserName: userSide.senderUserId !== ownerUserId ? userSide.senderName : (userSide.recipientEmail ?? "Vartotojas"),
      lastMessage: formatMsg(first),
      unread: 0,
    };
  });

  res.json(threads);
});

// GET /courts/:id/messages  — all messages in a thread the caller is part of
router.get("/courts/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  const { userId } = getAuth(req);
  if (Number.isNaN(courtId)) {
    res.status(400).json({ error: "courtId is required" });
    return;
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.courtId, courtId), or(eq(messagesTable.senderUserId, userId!), eq(messagesTable.recipientUserId, userId!))))
    .orderBy(messagesTable.createdAt);

  res.json(rows.map(formatMsg));
});

// POST /courts/:id/messages  — send a message (user→court or owner→user)
router.post("/courts/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  const { userId: senderUserId } = getAuth(req);
  const { senderName, senderEmail, body, threadUserId } = req.body ?? {};
  if (Number.isNaN(courtId) || !senderName || !senderEmail || !body) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const isOwner = court.ownerUserId === senderUserId;

  // When owner replies, threadUserId tells us who they're replying to
  let recipientUserId: string | null = null;
  let recipientEmail: string | null = null;

  if (isOwner && threadUserId) {
    // Owner replying to a user — find the user's email from prior messages
    const [prior] = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.courtId, courtId), eq(messagesTable.senderUserId, threadUserId)));
    recipientUserId = threadUserId;
    recipientEmail = prior?.senderEmail ?? null;
  } else {
    recipientUserId = court.ownerUserId ?? null;
    recipientEmail = court.ownerEmail ?? null;
  }

  const [message] = await db.insert(messagesTable).values({
    courtId,
    senderUserId: senderUserId!,
    senderName,
    senderEmail,
    recipientUserId,
    recipientEmail,
    subject: isOwner ? "Re: Žinutė nuo savininko" : "Žinutė kortui",
    body,
  }).returning();

  // Fire notification for the recipient
  if (recipientUserId) {
    await db.insert(notificationsTable).values({
      userId: recipientUserId,
      type: "message",
      title: isOwner ? `Atsakymas nuo savininko — ${court.name}` : `Nauja žinutė nuo ${senderName}`,
      body: body.length > 100 ? body.slice(0, 97) + "…" : body,
      link: isOwner ? "/profile" : `/courts/${courtId}`,
    }).catch(() => {});
  }

  res.status(201).json(formatMsg(message));
});

export default router;
