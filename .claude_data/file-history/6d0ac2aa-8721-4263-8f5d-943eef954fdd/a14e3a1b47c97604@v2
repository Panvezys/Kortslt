/**
 * One-off migration: for every existing coach with a pricePerHour set, create
 * a default "Individuali treniruotė (60 min)" service per sport they teach,
 * if no active service already exists for that (coach, sport).
 *
 * Idempotent — re-running skips any (coach, sport) that already has at least
 * one active service.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run migrate-coach-default-services
 */
import {
  db,
  coachesTable,
  coachServicesTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

async function main() {
  const coaches = await db
    .select({
      id: coachesTable.id,
      pricePerHour: coachesTable.pricePerHour,
      sports: coachesTable.sports,
    })
    .from(coachesTable);

  let created = 0;
  let skippedNoPrice = 0;
  let skippedHasService = 0;

  for (const c of coaches) {
    if (c.pricePerHour == null) {
      skippedNoPrice += 1;
      continue;
    }
    const sportsList: string[] = c.sports ?? [];
    if (sportsList.length === 0) continue;

    for (const sport of sportsList) {
      const existing = await db
        .select({ id: coachServicesTable.id })
        .from(coachServicesTable)
        .where(
          and(
            eq(coachServicesTable.coachId, c.id),
            eq(coachServicesTable.sport, sport),
            eq(coachServicesTable.isActive, true),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skippedHasService += 1;
        continue;
      }

      await db.insert(coachServicesTable).values({
        coachId: c.id,
        name: "Individuali treniruotė",
        description: null,
        sport,
        courtId: null,
        durationMin: 60,
        priceCents: c.pricePerHour,
        maxParticipants: 1,
        audienceLevel: null,
        isActive: true,
        sortOrder: 0,
      });
      created += 1;
    }
  }

  console.log(`✓ Created ${created} default services`);
  console.log(`  Skipped: ${skippedNoPrice} coaches without pricePerHour`);
  console.log(`  Skipped: ${skippedHasService} (coach, sport) pairs already had an active service`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
