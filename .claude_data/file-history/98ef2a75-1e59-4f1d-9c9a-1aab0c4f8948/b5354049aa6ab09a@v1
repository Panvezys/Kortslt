import { Router, type IRouter } from "express";
import { desc, eq, or, and, sql, inArray } from "drizzle-orm";
import { db, directMessagesTable, notificationsTable, userProfilesTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

function formatMsg(r: typeof directMessagesTable.$inferSelect) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
  };
}

// GET /dm/threads — list my conversations, grouped by "other user"
router.get("/dm/threads", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  const rows = await db.select().from(directMessagesTable)
    .where(or(eq(directMessagesTable.senderUserId, userId), eq(directMessagesTable.recipientUserId, userId)))
    .orderBy(desc(directMessagesTable.createdAt));

  const threadMap = new Map<string, {
    otherUserId: string;
    otherUserName: string;
    lastMessage: ReturnType<typeof formatMsg>;
    unread: number;
  }>();

  for (const r of rows) {
    const otherUserId = r.senderUserId === userId ? r.recipientUserId : r.senderUserId;
    const existing = threadMap.get(otherUserId);
    const isIncoming = r.recipientUserId === userId;
    const isUnread = isIncoming && !r.readAt;
    if (!existing) {
      threadMap.set(otherUserId, {
        otherUserId,
        otherUserName: r.senderUserId === userId ? "—" : r.senderName,
        lastMessage: formatMsg(r),
        unread: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }

  // Fill in names for threads where the latest message is from me
  for (const thread of threadMap.values()) {
    if (thread.otherUserName === "—") {
      const fromOther = rows.find(r => r.senderUserId === thread.otherUserId);
      if (fromOther) thread.otherUserName = fromOther.senderName;
      else thread.otherUserName = "Vartotojas";
    }
  }

  // Fetch avatars for all other users from userProfilesTable
  const otherIds = [...threadMap.keys()];
  const imageMap = new Map<string, string | null>();
  if (otherIds.length > 0) {
    const profiles = await db
      .select({ userId: userProfilesTable.userId, imageUrl: userProfilesTable.imageUrl })
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.userId, otherIds));
    for (const p of profiles) imageMap.set(p.userId, p.imageUrl);
  }

  const threads = [...threadMap.values()].map(t => ({
    ...t,
    otherUserImageUrl: imageMap.get(t.otherUserId) ?? null,
  }));

  res.json(threads);
});

// GET /dm/thread/:otherUserId — all messages between me and otherUserId
router.get("/dm/thread/:otherUserId", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const otherUserId = String(req.params.otherUserId);

  const rows = await db.select().from(directMessagesTable)
    .where(or(
      and(eq(directMessagesTable.senderUserId, userId), eq(directMessagesTable.recipientUserId, otherUserId)),
      and(eq(directMessagesTable.senderUserId, otherUserId), eq(directMessagesTable.recipientUserId, userId)),
    ))
    .orderBy(directMessagesTable.createdAt);

  // Mark incoming messages as read
  await db.update(directMessagesTable).set({ readAt: new Date() })
    .where(and(
      eq(directMessagesTable.senderUserId, otherUserId),
      eq(directMessagesTable.recipientUserId, userId),
      sql`${directMessagesTable.readAt} IS NULL`,
    ));

  res.json(rows.map(formatMsg));
});

// POST /dm/send — send a direct message
router.post("/dm/send", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const { senderName, recipientUserId, body, contextType, contextId } = req.body ?? {};
  if (!senderName || !recipientUserId || !body) {
    res.status(400).json({ error: "senderName, recipientUserId, body required" }); return;
  }

  const [msg] = await db.insert(directMessagesTable).values({
    senderUserId: userId,
    senderName,
    recipientUserId,
    body,
    contextType: contextType ?? null,
    contextId: contextId ?? null,
  }).returning();

  // Notification for recipient
  await db.insert(notificationsTable).values({
    userId: recipientUserId,
    type: "message",
    title: `Nauja žinutė nuo ${senderName}`,
    body: body.length > 100 ? body.slice(0, 97) + "…" : body,
    link: `/messages?u=${userId}`,
  }).catch(() => {});

  res.status(201).json(formatMsg(msg));
});

// GET /dm/unread-count
router.get("/dm/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(directMessagesTable)
    .where(and(eq(directMessagesTable.recipientUserId, userId), sql`${directMessagesTable.readAt} IS NULL`));
  res.json({ count: Number(row?.count ?? 0) });
});

export default router;
