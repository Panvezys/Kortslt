import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// Audit ledger for platform-level purchases (e.g. 7-day "Bump" promotions).
// Every fulfilled Stripe checkout writes one row here in the same transaction
// that flips the target's promotedUntil column — so this table is the
// canonical revenue record and the source of the admin Revenue dashboard.
//
// `stripeSessionId` is UNIQUE: the webhook is idempotent against retries.
export const platformPurchasesTable = pgTable(
  "platform_purchases",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // 'coach' | 'court' | 'tournament'
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    stripeSessionId: text("stripe_session_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCreatedAt: index("platform_purchases_created_at_idx").on(t.createdAt),
    byUser: index("platform_purchases_user_idx").on(t.userId),
  }),
);

export type PlatformPurchase = typeof platformPurchasesTable.$inferSelect;
