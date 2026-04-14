import { Router, type IRouter } from "express";
import { desc, eq, or, and } from "drizzle-orm";
import { db, messagesTable, courtsTable } from "@workspace/db";

const router: IRouter = Router();

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
    .orderBy(desc(messagesTable.createdAt));

  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/courts/:id/messages", async (req, res): Promise<void> => {
  const courtId = Number(req.params.id);
  const { senderUserId, senderName, senderEmail, subject, body } = req.body ?? {};
  if (Number.isNaN(courtId) || !senderUserId || !senderName || !senderEmail || !subject || !body) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, courtId));
  if (!court) {
    res.status(404).json({ error: "Court not found" });
    return;
  }

  const [message] = await db.insert(messagesTable).values({
    courtId,
    senderUserId,
    senderName,
    senderEmail,
    recipientUserId: court.ownerUserId ?? null,
    recipientEmail: court.ownerEmail ?? null,
    subject,
    body,
  }).returning();

  res.status(201).json({ ...message, createdAt: message.createdAt.toISOString() });
});

export default router;