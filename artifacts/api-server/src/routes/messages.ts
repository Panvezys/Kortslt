import { Router, type IRouter } from "express";
import { desc, eq, or, and, inArray } from "drizzle-orm";
import { db, messagesTable, courtsTable } from "@workspace/db";

const router: IRouter = Router();

function formatMsg(r: typeof messagesTable.$inferSelect) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

// GET /messages/inbox?userId=X  — all threads the user participated in
router.get("/messages/inbox", async (req, res): Promise<void> => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(or(eq(messagesTable.senderUserId, userId), eq(messagesTable.recipientUserId, userId)))
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

// GET /messages/owner-inbox?ownerUserId=X  — all threads across owner's courts
router.get("/messages/owner-inbox", async (req, res): Promise<void> => {
  const ownerUserId = typeof req.query.ownerUserId === "string" ? req.query.ownerUserId : "";
  if (!ownerUserId) { res.status(400).json({ error: "ownerUserId required" }); return; }

  const ownedCourts = await db
    .select({ id: courtsTable.id, name: courtsTable.name })
    .from(courtsTable)
    .where(eq(courtsTable.ownerUserId, ownerUserId));

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

// GET /courts/:id/messages?userId=X  — all messages in a thread (courtId + userId)
router.get("/courts/:id/messages", async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (Number.isNaN(courtId) || !userId) {
    res.status(400).json({ error: "courtId and userId are required" });
    return;
  }

  const rows = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.courtId, courtId), or(eq(messagesTable.senderUserId, userId), eq(messagesTable.recipientUserId, userId))))
    .orderBy(messagesTable.createdAt);

  res.json(rows.map(formatMsg));
});

// POST /courts/:id/messages  — send a message (user→court or owner→user)
router.post("/courts/:id/messages", async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  const { senderUserId, senderName, senderEmail, body, threadUserId } = req.body ?? {};
  if (Number.isNaN(courtId) || !senderUserId || !senderName || !senderEmail || !body) {
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
    senderUserId,
    senderName,
    senderEmail,
    recipientUserId,
    recipientEmail,
    subject: isOwner ? "Re: Žinutė nuo savininko" : "Žinutė kortui",
    body,
  }).returning();

  res.status(201).json(formatMsg(message));
});

export default router;
