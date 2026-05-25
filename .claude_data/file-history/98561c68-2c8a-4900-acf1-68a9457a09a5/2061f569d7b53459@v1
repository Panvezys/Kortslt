/**
 * Invariant A — denormalized "starting from" price sync.
 *
 * coachesTable.pricePerHour is the only price the marketplace cards read for
 * sorting and filtering. It mirrors the lowest priceCents across the coach's
 * active services so that mutation traffic to coach_services keeps the card
 * fresh without re-aggregating on every list query.
 *
 * Always call from inside the same transaction as the service create/update/
 * delete so the recompute commits or rolls back atomically with the
 * underlying change. The optional `exec` parameter accepts either the global
 * `db` or a drizzle transaction handle — both support the same select/update
 * surface this helper uses.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, coachesTable, coachServicesTable } from "@workspace/db";

export type CoachPricingExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function syncCoachStartingPrice(
  coachId: number,
  exec: CoachPricingExecutor = db,
): Promise<void> {
  const [row] = await exec
    .select({
      minPrice: sql<number | null>`MIN(${coachServicesTable.priceCents})`,
    })
    .from(coachServicesTable)
    .where(
      and(
        eq(coachServicesTable.coachId, coachId),
        eq(coachServicesTable.isActive, true),
      ),
    );

  // No active services → set to 0 so card UI / filters can detect the
  // "no bookable services" case without a separate query.
  const minPrice = row?.minPrice ?? 0;

  await exec
    .update(coachesTable)
    .set({ pricePerHour: minPrice })
    .where(eq(coachesTable.id, coachId));
}
