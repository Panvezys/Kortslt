/**
 * One-off backfill: recompute `coaches.pricePerHour` for every coach using the
 * same per-hour normalized formula that `syncCoachStartingPrice` (in
 * artifacts/api-server/src/lib/coach-pricing.ts) now applies on every service
 * mutation.
 *
 * Why: when the marketplace was hybrid-priced (manual input on the Settings
 * page + a buggy `MIN(priceCents)` sync), existing rows accumulated stale
 * values. The new flow always derives `pricePerHour` from active services,
 * but it only fires when a service changes — coaches who haven't touched
 * their service catalog since the fix still have the old stale value.
 *
 * This script visits every coach once and rewrites the column. Idempotent:
 * a coach whose value already matches the derived formula is left untouched.
 *
 * Defaults to dry-run. Pass `--apply` to actually write changes.
 *
 *   pnpm --filter @workspace/scripts run resync-coach-baseline-prices
 *   pnpm --filter @workspace/scripts run resync-coach-baseline-prices -- --apply
 */
import {
  db,
  coachesTable,
  coachServicesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

function fmtCents(cents: number | null): string {
  if (cents == null) return "null";
  return `${(cents / 100).toFixed(2)} €`;
}

async function computeBaseline(coachId: number): Promise<number> {
  const [row] = await db
    .select({
      minHourlyCents: sql<number | null>`
        MIN(
          ROUND(${coachServicesTable.priceCents}::numeric * 60 / ${coachServicesTable.durationMin})
        )::integer
      `,
    })
    .from(coachServicesTable)
    .where(
      and(
        eq(coachServicesTable.coachId, coachId),
        eq(coachServicesTable.isActive, true),
      ),
    );
  return row?.minHourlyCents ?? 0;
}

async function main() {
  const coaches = await db
    .select({
      id: coachesTable.id,
      name: coachesTable.name,
      pricePerHour: coachesTable.pricePerHour,
    })
    .from(coachesTable)
    .orderBy(coachesTable.id);

  console.log(`Mode: ${APPLY ? "APPLY (writes will happen)" : "DRY-RUN (no writes)"}`);
  console.log(`Total coaches: ${coaches.length}\n`);

  let changed = 0;
  let unchanged = 0;
  let zeroed = 0;

  for (const c of coaches) {
    const next = await computeBaseline(c.id);
    const prev = c.pricePerHour ?? 0;
    if (next === prev) {
      unchanged += 1;
      continue;
    }
    changed += 1;
    if (next === 0) zeroed += 1;
    console.log(
      `coach #${c.id} (${c.name}): ${fmtCents(c.pricePerHour)} → ${fmtCents(next)}${next === 0 ? "  [no active services]" : ""}`,
    );

    if (APPLY) {
      await db
        .update(coachesTable)
        .set({ pricePerHour: next })
        .where(eq(coachesTable.id, c.id));
    }
  }

  console.log(`\nSummary: ${changed} would change, ${unchanged} already correct${zeroed ? `, ${zeroed} of the changes drop to 0 (no active services)` : ""}.`);
  if (!APPLY && changed > 0) {
    console.log(`Re-run with --apply to write the changes.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
