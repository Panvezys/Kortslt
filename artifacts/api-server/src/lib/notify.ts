import { db, notificationsTable, notificationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type NotifType =
  | "game_join_request"
  | "game_cancelled"
  | "booking_created"
  | "booking_cancelled"
  | "court_approved"
  | "court_rejected"
  | "message";

const TYPE_TO_SETTING: Record<NotifType, keyof typeof notificationSettingsTable.$inferSelect> = {
  game_join_request: "gameJoinRequest",
  game_cancelled: "gameCancelled",
  booking_created: "bookingCreated",
  booking_cancelled: "bookingCancelled",
  court_approved: "courtApproved",
  court_rejected: "courtApproved",
  message: "messageReceived",
};

async function shouldNotify(userId: string, type: NotifType): Promise<boolean> {
  try {
    const [row] = await db
      .select()
      .from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.userId, userId));
    if (!row) return true;
    const field = TYPE_TO_SETTING[type];
    return row[field] as boolean;
  } catch {
    return true;
  }
}

export async function sendNotification(
  userId: string,
  type: NotifType,
  title: string,
  body: string,
  link?: string,
) {
  try {
    const allowed = await shouldNotify(userId, type);
    if (!allowed) return;
    await db.insert(notificationsTable).values({
      userId,
      type,
      title,
      body,
      link: link ?? null,
    });
  } catch { /* silent */ }
}
