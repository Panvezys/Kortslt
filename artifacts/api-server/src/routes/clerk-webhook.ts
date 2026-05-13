/**
 * Clerk webhook endpoint — POST /api/webhooks/clerk
 *
 * Listens for user.created events and stitches any guest booking/game-participant
 * records (matched by email) to the newly-created Clerk user ID.
 *
 * Signature verification uses svix (the library Clerk uses to sign webhooks).
 * Set CLERK_WEBHOOK_SECRET to the signing secret from the Clerk Dashboard → Webhooks.
 */
import type { Request, Response } from "express";
import { Webhook } from "svix";
import { and, eq, isNull } from "drizzle-orm";
import { db, gameParticipantsTable, bookingsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function handleClerkWebhook(req: Request, res: Response): Promise<void> {
  if (!CLERK_WEBHOOK_SECRET) {
    logger.warn("CLERK_WEBHOOK_SECRET not set — rejecting Clerk webhook");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing svix headers" });
    return;
  }

  let event: { type: string; data: Record<string, any> };
  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    const body = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : JSON.stringify(req.body);
    event = wh.verify(body, {
      "svix-id": String(svixId),
      "svix-timestamp": String(svixTimestamp),
      "svix-signature": String(svixSignature),
    }) as typeof event;
  } catch (err) {
    logger.error({ err }, "Clerk webhook signature verification failed");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  if (event.type !== "user.created") {
    res.json({ received: true });
    return;
  }

  const newUserId: string = event.data.id;
  const primaryEmailId: string | undefined = event.data.primary_email_address_id;
  const primaryEmail: string | undefined = (event.data.email_addresses as Array<{ id: string; email_address: string }> | undefined)
    ?.find(e => e.id === primaryEmailId)
    ?.email_address;

  if (!primaryEmail) {
    logger.warn({ userId: newUserId }, "Clerk user.created event had no resolvable primary email — skipping claim");
    res.json({ received: true });
    return;
  }

  // Claim guest game_participants rows: link them to the new Clerk user and
  // clear the guest email so the row is now a proper authenticated-user row.
  const participants = await db
    .update(gameParticipantsTable)
    .set({ userId: newUserId, userEmail: null })
    .where(eq(gameParticipantsTable.userEmail, primaryEmail))
    .returning({ id: gameParticipantsTable.id });

  // Claim orphaned guest bookings (no Clerk user yet, email matches).
  const bookings = await db
    .update(bookingsTable)
    .set({ bookerUserId: newUserId })
    .where(and(
      eq(bookingsTable.customerEmail, primaryEmail),
      isNull(bookingsTable.bookerUserId),
    ))
    .returning({ id: bookingsTable.id });

  logger.info(
    {
      userId: newUserId,
      email: primaryEmail,
      claimedParticipants: participants.length,
      claimedBookings: bookings.length,
    },
    "Claimed guest records for new Clerk user",
  );

  res.json({ received: true });
}
