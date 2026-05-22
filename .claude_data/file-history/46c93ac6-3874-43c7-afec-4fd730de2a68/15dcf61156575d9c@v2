/**
 * Wipes everything seeded by `seed-demo-coaches.ts`. Identifies rows by the
 * 'demo-seed-' user prefix on coaches.user_id and facilities.owner_user_id.
 *
 * Drizzle ON DELETE CASCADE handles court_coaches, coach_sports,
 * coach_availabilities, court_blocked_slots, etc. automatically.
 */
import {
  db,
  facilitiesTable,
  coachesTable,
  userProfilesTable,
} from "@workspace/db";
import { like } from "drizzle-orm";

const DEMO_PREFIX = "demo-seed-";
// Must mirror the dummy id produced by seed-demo-coaches.ts so we only wipe
// rows the seed itself created. Filtering on this pattern guarantees we never
// touch a real signed-in user's profile.
const DEMO_STRIPE_PREFIX = "acct_mock_dev_";

async function main() {
  const deletedCoaches = await db
    .delete(coachesTable)
    .where(like(coachesTable.userId, `${DEMO_PREFIX}%`))
    .returning({ id: coachesTable.id });
  console.log(`✓ Deleted ${deletedCoaches.length} coaches (sports, availability, affiliations cascade)`);

  const deletedFacilities = await db
    .delete(facilitiesTable)
    .where(like(facilitiesTable.ownerUserId, `${DEMO_PREFIX}%`))
    .returning({ id: facilitiesTable.id });
  console.log(`✓ Deleted ${deletedFacilities.length} facilities (courts cascade)`);

  const deletedProfiles = await db
    .delete(userProfilesTable)
    .where(like(userProfilesTable.stripeAccountId, `${DEMO_STRIPE_PREFIX}%`))
    .returning({ userId: userProfilesTable.userId });
  console.log(`✓ Deleted ${deletedProfiles.length} mock user_profiles (acct_mock_dev_*)`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
