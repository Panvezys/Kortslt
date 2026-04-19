import { Router, type IRouter } from "express";
import { db, notificationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

async function getOrCreateSettings(userId: string) {
  const [existing] = await db
    .select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.userId, userId));
  if (existing) return existing;

  const [created] = await db
    .insert(notificationSettingsTable)
    .values({ userId })
    .returning();
  return created;
}

router.get("/notification-settings", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const settings = await getOrCreateSettings(userId);
  res.json(settings);
});

router.put("/notification-settings", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;
  const {
    gameJoinRequest,
    gameCancelled,
    bookingCreated,
    bookingCancelled,
    courtApproved,
    messageReceived,
  } = req.body ?? {};

  const [row] = await db
    .insert(notificationSettingsTable)
    .values({
      userId,
      ...(gameJoinRequest !== undefined && { gameJoinRequest: !!gameJoinRequest }),
      ...(gameCancelled !== undefined && { gameCancelled: !!gameCancelled }),
      ...(bookingCreated !== undefined && { bookingCreated: !!bookingCreated }),
      ...(bookingCancelled !== undefined && { bookingCancelled: !!bookingCancelled }),
      ...(courtApproved !== undefined && { courtApproved: !!courtApproved }),
      ...(messageReceived !== undefined && { messageReceived: !!messageReceived }),
    })
    .onConflictDoUpdate({
      target: notificationSettingsTable.userId,
      set: {
        ...(gameJoinRequest !== undefined && { gameJoinRequest: !!gameJoinRequest }),
        ...(gameCancelled !== undefined && { gameCancelled: !!gameCancelled }),
        ...(bookingCreated !== undefined && { bookingCreated: !!bookingCreated }),
        ...(bookingCancelled !== undefined && { bookingCancelled: !!bookingCancelled }),
        ...(courtApproved !== undefined && { courtApproved: !!courtApproved }),
        ...(messageReceived !== undefined && { messageReceived: !!messageReceived }),
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(row);
});

export default router;
