import { Router } from "express";
import { db, waitlistsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "../lib/auth";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const JoinWaitlistBody = z.object({
  courtId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(4),
  endTime: z.string().min(4),
  email: z.string().email(),
  name: z.string().optional(),
});

// POST /api/waitlists — join the waitlist for a specific court slot
router.post("/waitlists", async (req, res): Promise<void> => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { courtId, date, startTime, endTime, email, name } = parsed.data;
  const userId = getCurrentUserId(req) ?? null;

  // Deduplicate: one entry per (courtId, date, startTime, endTime, email)
  const existing = await db
    .select()
    .from(waitlistsTable)
    .where(
      and(
        eq(waitlistsTable.courtId, courtId),
        eq(waitlistsTable.date, date),
        eq(waitlistsTable.startTime, startTime),
        eq(waitlistsTable.endTime, endTime),
        eq(waitlistsTable.email, email),
      ),
    );

  if (existing.length > 0) {
    res.json({ id: existing[0].id, alreadyRegistered: true });
    return;
  }

  try {
    const [entry] = await db
      .insert(waitlistsTable)
      .values({ courtId, date, startTime, endTime, userId, email, name: name ?? null })
      .returning();
    logger.info({ waitlistId: entry.id, courtId, date, startTime }, "Waitlist entry created");
    res.status(201).json(entry);
  } catch (err) {
    logger.error({ err }, "Waitlist insert failed");
    res.status(500).json({ error: "Failed to join waitlist" });
  }
});

export default router;
