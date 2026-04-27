import { Router, type IRouter } from "express";
import { eq, or, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, bookingsTable } from "@workspace/db";
import { requireAuth, getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();

// POST /delete-user-data — wipes the authenticated user's bookings.
// Called by the frontend immediately before invoking Clerk's user.delete().
//
// We match bookings by BOTH bookerUserId AND primary email so that legacy or
// guest-checkout bookings (which only set customerEmail) are also wiped.
// Email comparison is case-insensitive because customerEmail is not normalized
// at write-time in the booking creation path.
router.post("/delete-user-data", requireAuth, async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req)!;

  // Resolve the user's primary email server-side. We MUST have this to wipe
  // legacy bookings — fail closed rather than report a partial deletion as
  // success.
  let email: string;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const found = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!found) throw new Error("No primary email on Clerk user");
    email = found.toLowerCase();
  } catch (err) {
    console.error("[delete-user-data] Failed to resolve user email — aborting", { userId, err });
    res.status(502).json({ error: "Failed to resolve account email; please try again." });
    return;
  }

  const deleted = await db
    .delete(bookingsTable)
    .where(
      or(
        eq(bookingsTable.bookerUserId, userId),
        sql`lower(${bookingsTable.customerEmail}) = ${email}`,
      ),
    )
    .returning({ id: bookingsTable.id });

  res.json({ ok: true, bookingsDeleted: deleted.length });
});

export default router;
